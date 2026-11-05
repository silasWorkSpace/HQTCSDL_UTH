# LivingDocs AI Engine - LLM Module

Module phụ trách tích hợp và trừu tượng hóa mô hình ngôn ngữ lớn (LLM) để sinh bản thảo tài liệu (DocDraft) tự động từ code entities và template.

## Chức năng
- **LlmProvider Interface**: Abstraction chuẩn cho các LLM Provider.
- **MockProvider**: Deterministic Mock Provider phục vụ offline testing, không yêu cầu API key.
- **Secret Masker**: Tự động nhận diện và che giấu các sensitive token, API keys, passwords trước khi sinh tài liệu (NFR-SEC-08).
- **DocDraft Schema**: Pydantic schema chuẩn định nghĩa các trường cấu trúc, section, confidence và grounding evidence.

## Biến môi trường
- `LLM_PROVIDER`: `mock` (mặc định)
- `LLM_MODEL`: `mock-model-v1`
- `PORT`: `8000`

## Cách chạy
### Local
```bash
cd backend/ai-engine
pip install -r requirements.txt
uvicorn app.main:app --port 8000 --reload
```

### Chạy Tests
```bash
python -m pytest tests -v
```

### Docker
```bash
docker build -t livingdocs-ai-engine .
docker run -p 8000:8000 livingdocs-ai-engine
```

