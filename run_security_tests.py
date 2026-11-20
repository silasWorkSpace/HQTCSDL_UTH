import os, json, csv, random, hashlib
from pathlib import Path
from collections import Counter
from cryptography.hazmat.primitives.ciphers.aead import AESGCM, ChaCha20Poly1305
from cryptography.exceptions import InvalidTag
OUT=Path(__file__).resolve().parents[1] / 'results'
OUT.mkdir(parents=True, exist_ok=True)
algos=[('AES-256-GCM',AESGCM),('ChaCha20-Poly1305',ChaCha20Poly1305)]
results=[]
for name, cls in algos:
    key=os.urandom(32); a=cls(key); nonce=os.urandom(12); plaintext=b'This is a controlled AEAD test message.'; aad=b'file=sample.txt;version=1'
    ct=a.encrypt(nonce,plaintext,aad)
    def succeeds(label, func, expected_success):
        try:
            out=func()
            success=True
            msg='accepted'
        except InvalidTag:
            success=False; out=None; msg='InvalidTag rejected'
        passed=(success==expected_success)
        results.append({'algorithm':name,'test':label,'expected':'accepted' if expected_success else 'rejected','actual':msg,'pass':passed})
        if label=='valid round-trip': assert passed and out==plaintext
        elif not expected_success: assert passed
    succeeds('valid round-trip',lambda:a.decrypt(nonce,ct,aad),True)
    b=bytearray(ct); b[0]^=1
    succeeds('tamper ciphertext',lambda:a.decrypt(nonce,bytes(b),aad),False)
    b=bytearray(ct); b[-1]^=1
    succeeds('tamper tag',lambda:a.decrypt(nonce,bytes(b),aad),False)
    succeeds('tamper AAD',lambda:a.decrypt(nonce,ct,aad+b'X'),False)
    wrong=cls(os.urandom(32))
    succeeds('wrong key',lambda:wrong.decrypt(nonce,ct,aad),False)
    wrong_nonce=bytes([nonce[0]^1])+nonce[1:]
    succeeds('wrong nonce',lambda:a.decrypt(wrong_nonce,ct,aad),False)
with open(OUT/'security_test_results.csv','w',newline='',encoding='utf-8') as f:
    w=csv.DictWriter(f,fieldnames=list(results[0].keys()));w.writeheader();w.writerows(results)
# Counter uniqueness sample
N=100_000
counter_nonces=[i.to_bytes(12,'big') for i in range(N)]
counter_unique=len(set(counter_nonces))
# random 96-bit sample, in the observed run
random_nonces=[os.urandom(12) for _ in range(N)]
random_unique=len(set(random_nonces))
# Deliberately small 16-bit toy space to illustrate birthday collisions; not used for encryption
random.seed(20261028)
toy=[random.randrange(0,2**16) for _ in range(N)]
toy_unique=len(set(toy)); toy_duplicate_values=N-toy_unique
nonce_summary={
 'sample_size':N,
 'counter_96bit':{'total':N,'unique':counter_unique,'duplicates':N-counter_unique},
 'random_96bit_observed':{'total':N,'unique':random_unique,'duplicates':N-random_unique,'note':'A single sample with no collision does not establish collision impossibility.'},
 'toy_random_16bit':{'total':N,'unique':toy_unique,'duplicate_draws':toy_duplicate_values,'note':'Toy space only to make birthday collisions visible; not a recommended nonce size or used for actual AEAD encryption.'}
}
with open(OUT/'nonce_simulation.json','w',encoding='utf-8') as f:json.dump(nonce_summary,f,indent=2)
print('Tests:',len(results),'passed:',sum(r['pass'] for r in results),'failed:',sum(not r['pass'] for r in results))
for r in results: print(r)
print(nonce_summary)
