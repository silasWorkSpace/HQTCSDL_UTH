import pandas as pd
import matplotlib.pyplot as plt
from pathlib import Path
p=Path(__file__).resolve().parents[1]
results=p/'results'
figures=p/'figures'
figures.mkdir(parents=True, exist_ok=True)
df=pd.read_csv(results/'benchmark_summary.csv')
order=['1 KB','4 KB','64 KB','1 MB','10 MB','100 MB']
labels=['1 KB','4 KB','64 KB','1 MB','10 MB','100 MB']
# Use simple unstyled matplotlib defaults; ensure fonts have Vietnamese glyph coverage if possible.
plt.rcParams['font.family']='DejaVu Sans'
for operation in ['encrypt','decrypt']:
    fig, ax=plt.subplots(figsize=(8.2,4.6))
    for algo in ['AES-256-GCM','ChaCha20-Poly1305']:
        sub=df[(df.algorithm==algo)&(df.operation==operation)].set_index('size_label').loc[order]
        ax.plot(labels, sub['median_throughput_MiB_s'], marker='o', linewidth=2, label=algo)
    ax.set_title(f'Throughput đo được - {operation.capitalize()}')
    ax.set_xlabel('Kích thước bản rõ')
    ax.set_ylabel('MiB/s (median của 5 lần đo)')
    ax.grid(True, alpha=0.3)
    ax.legend()
    fig.tight_layout()
    fig.savefig(figures/f'throughput_{operation}.png',dpi=180)
    plt.close(fig)
# Latency log scale for all four series
fig, ax=plt.subplots(figsize=(8.2,4.8))
for algo in ['AES-256-GCM','ChaCha20-Poly1305']:
    for operation in ['encrypt','decrypt']:
        sub=df[(df.algorithm==algo)&(df.operation==operation)].set_index('size_label').loc[order]
        ax.plot(labels, sub['median_latency_ms'], marker='o', linewidth=2, label=f'{algo} / {operation}')
ax.set_yscale('log')
ax.set_title('Độ trễ trung vị theo kích thước dữ liệu')
ax.set_xlabel('Kích thước bản rõ')
ax.set_ylabel('ms/operation (thang logarit)')
ax.grid(True, which='both', alpha=0.3)
ax.legend(fontsize=8)
fig.tight_layout()
fig.savefig(figures/'latency_all.png',dpi=180)
plt.close(fig)
print('charts created')
