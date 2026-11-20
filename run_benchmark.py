import os, csv, time, platform, sys, statistics, ssl, json
from pathlib import Path
from datetime import datetime, timezone
from cryptography import __version__ as cryptography_version
from cryptography.hazmat.primitives.ciphers.aead import AESGCM, ChaCha20Poly1305

OUT=Path(__file__).resolve().parents[1] / 'results'
OUT.mkdir(parents=True, exist_ok=True)
SIZES=[('1 KB', 1*1024, 32768), ('4 KB',4*1024,8192), ('64 KB',64*1024,512), ('1 MB',1*1024*1024,32), ('10 MB',10*1024*1024,3), ('100 MB',100*1024*1024,1)]
TRIALS=5
ALGOS=[('AES-256-GCM', AESGCM(os.urandom(32))), ('ChaCha20-Poly1305', ChaCha20Poly1305(os.urandom(32)))]
AAD=b'benchmark-aad-v1'
PLAINTEXTS={label: os.urandom(size) for label,size,_ in SIZES}
rows=[]
summary=[]
for name, aead in ALGOS:
    nonce_counter=1
    for label, size, n_ops in SIZES:
        print(f'Benchmark {name} {label} ...', flush=True)
        plaintext=PLAINTEXTS[label]
        # warm up
        warm_nonce=nonce_counter.to_bytes(12,'big'); nonce_counter += 1
        warm_ct=aead.encrypt(warm_nonce, plaintext, AAD)
        assert aead.decrypt(warm_nonce, warm_ct, AAD) == plaintext
        enc_rates=[]; enc_lat=[]; dec_rates=[]; dec_lat=[]
        for trial in range(1, TRIALS+1):
            # Encryption: every invocation uses a distinct nonce for this key.
            nonces=[]
            for _ in range(n_ops):
                nonces.append(nonce_counter.to_bytes(12,'big'))
                nonce_counter += 1
            t0=time.perf_counter()
            last_ct=None
            for nonce in nonces:
                last_ct=aead.encrypt(nonce, plaintext, AAD)
            elapsed=time.perf_counter()-t0
            total=size*n_ops
            rate=(total/elapsed)/(1024**2)
            lat=(elapsed/n_ops)*1000
            enc_rates.append(rate); enc_lat.append(lat)
            rows.append({'algorithm':name,'operation':'encrypt','size_label':label,'bytes_per_message':size,'operations_per_trial':n_ops,'trial':trial,'elapsed_seconds':elapsed,'throughput_MiB_s':rate,'latency_ms_per_operation':lat,'aad_bytes':len(AAD),'key_bits':256,'nonce_bytes':12,'tag_bits':128})
            # Produce one valid ciphertext for decryption timing using a fresh nonce.
            # Repeated decryption is safe; nonce uniqueness applies to encryption invocations.
            nonce_dec=nonce_counter.to_bytes(12,'big'); nonce_counter += 1
            ct_dec=aead.encrypt(nonce_dec, plaintext, AAD)
            assert aead.decrypt(nonce_dec, ct_dec, AAD) == plaintext
            t0=time.perf_counter()
            for _ in range(n_ops):
                pt=aead.decrypt(nonce_dec, ct_dec, AAD)
            elapsed_dec=time.perf_counter()-t0
            assert pt == plaintext
            rate_dec=(total/elapsed_dec)/(1024**2)
            lat_dec=(elapsed_dec/n_ops)*1000
            dec_rates.append(rate_dec); dec_lat.append(lat_dec)
            rows.append({'algorithm':name,'operation':'decrypt','size_label':label,'bytes_per_message':size,'operations_per_trial':n_ops,'trial':trial,'elapsed_seconds':elapsed_dec,'throughput_MiB_s':rate_dec,'latency_ms_per_operation':lat_dec,'aad_bytes':len(AAD),'key_bits':256,'nonce_bytes':12,'tag_bits':128})
            del nonces
        for op, rates, lats in [('encrypt',enc_rates,enc_lat),('decrypt',dec_rates,dec_lat)]:
            summary.append({'algorithm':name,'operation':op,'size_label':label,'bytes_per_message':size,'operations_per_trial':n_ops,'trials':TRIALS,'median_throughput_MiB_s':statistics.median(rates),'mean_throughput_MiB_s':statistics.mean(rates),'stdev_throughput_MiB_s':statistics.stdev(rates) if len(rates)>1 else 0,'median_latency_ms':statistics.median(lats),'mean_latency_ms':statistics.mean(lats),'min_throughput_MiB_s':min(rates),'max_throughput_MiB_s':max(rates)})
        del warm_ct

with open(OUT/'benchmark_raw.csv','w',newline='',encoding='utf-8') as f:
    w=csv.DictWriter(f,fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)
with open(OUT/'benchmark_summary.csv','w',newline='',encoding='utf-8') as f:
    w=csv.DictWriter(f,fieldnames=list(summary[0].keys())); w.writeheader(); w.writerows(summary)
def get_cpu_model():
    try:
        import winreg
        key = winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r'HARDWARE\DESCRIPTION\System\CentralProcessor\0')
        val, _ = winreg.QueryValueEx(key, 'ProcessorNameString')
        return val.strip()
    except Exception:
        pass
    try:
        if os.path.exists('/proc/cpuinfo'):
            return next((line.split(':', 1)[1].strip() for line in open('/proc/cpuinfo', encoding='utf-8', errors='ignore') if line.lower().startswith('model name')), '')
    except Exception:
        pass
    return platform.processor() or platform.machine()

metadata={
 'date_utc':datetime.now(timezone.utc).isoformat(),
 'python_version':sys.version,
 'cryptography_version':cryptography_version,
 'openssl_version':ssl.OPENSSL_VERSION,
 'platform':platform.platform(),
 'processor':platform.processor(),
 'cpu_count_logical':os.cpu_count(),
 'cpu_model': get_cpu_model(),
 'trials_per_size_operation':TRIALS,
 'sizes':[{'label':label,'bytes':size,'ops_per_trial':ops} for label,size,ops in SIZES],
 'key_bits':256,'nonce_bytes':12,'tag_bits':128,'aad':'benchmark-aad-v1',
 'methodology':'The same pre-generated plaintext payload is used for both algorithms at each size. For sizes through 1 MB, operation count is chosen to process about 32 MiB per trial; 10 MB uses 3 operations and 100 MB uses 1 operation. Encryption throughput timed only AEAD encrypt calls with unique 96-bit counter nonces per encryption invocation under each key. Decryption uses an independently produced valid ciphertext per trial and times repeated decryptions of that ciphertext; nonce uniqueness is required for encryption invocations, not repeated decryption. Data generation, nonce creation, warm-up, and correctness checks are excluded from timed intervals. The timing loops use explicit loops for both operations. Throughput is MiB/s (1024^2 bytes per second); per-operation latency is elapsed time divided by number of operations. Five trial observations per algorithm/operation/size.'
}
with open(OUT/'benchmark_environment.json','w',encoding='utf-8') as f: json.dump(metadata,f,indent=2,ensure_ascii=False)
print('\nSUMMARY')
for r in summary:
 print(f"{r['algorithm']:<22} {r['operation']:<7} {r['size_label']:<7} med={r['median_throughput_MiB_s']:.2f} MiB/s lat={r['median_latency_ms']:.4f} ms")
