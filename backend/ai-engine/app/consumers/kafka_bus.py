"""
LivingDocs AI Engine - Kafka Event Bus & Dispatcher
Cung cấp kết nối Producer/Consumer tới Apache Kafka broker.
Hỗ trợ cả môi trường có Kafka và chế độ giả lập (Mock/Dev) an toàn.
"""
from __future__ import annotations

import json
import logging
import os
import threading
import time
from typing import Any, Callable, Dict, List, Optional

logger = logging.getLogger(__name__)

# Thử import thư viện Kafka (kafka-python)
try:
    from kafka import KafkaConsumer, KafkaProducer
    KAFKA_LIB_AVAILABLE = True
except ImportError:
    KAFKA_LIB_AVAILABLE = False
    logger.info("Thư viện kafka-python chưa được cài đặt. Kích hoạt chế độ Simulated In-Memory Bus.")


class KafkaEventBus:
    """Quản lý kết nối phát (Producer) và nhận (Consumer) sự kiện Kafka."""

    def __init__(self, bootstrap_servers: Optional[str] = None):
        self.bootstrap_servers = bootstrap_servers or os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
        self.enabled = os.getenv("KAFKA_ENABLED", "true").lower() in ("true", "1", "yes")
        self.producer = None
        self.consumers: List[threading.Thread] = []
        self.running = False
        self.sent_events: List[Dict[str, Any]] = []  # Lưu lịch sử sự kiện đã phát phục vụ audit/debug

        if self.enabled and KAFKA_LIB_AVAILABLE:
            try:
                self.producer = KafkaProducer(
                    bootstrap_servers=self.bootstrap_servers,
                    value_serializer=lambda v: json.dumps(v).encode("utf-8"),
                    key_serializer=lambda k: k.encode("utf-8") if k else None,
                    request_timeout_ms=5000,
                    retries=3,
                )
                logger.info("Đã kết nối thành công Kafka Producer tới %s", self.bootstrap_servers)
            except Exception as ex:
                logger.warning("Không thể khởi tạo KafkaProducer tới %s (%s). Chuyển sang fallback.", self.bootstrap_servers, ex)
                self.producer = None

    def publish(self, topic: str, key: Optional[str], envelope: Dict[str, Any]) -> bool:
        """Phát một envelope sự kiện lên topic Kafka."""
        self.sent_events.append({"topic": topic, "key": key, "envelope": envelope, "timestamp": time.time()})
        logger.info("[KAFKA SEND] Topic: %s | Key: %s | Type: %s | EventID: %s",
                    topic, key, envelope.get("type"), envelope.get("eventId"))

        if self.producer:
            try:
                future = self.producer.send(topic, key=key, value=envelope)
                self.producer.flush(timeout=2)
                logger.debug("Đã gửi message lên Kafka topic %s thành công", topic)
                return True
            except Exception as ex:
                logger.error("Lỗi khi gửi message lên Kafka topic %s: %s", topic, ex)
                return False
        else:
            logger.info("[SIMULATED BUS] Sự kiện đã được ghi nhận trong memory bus (Topic: %s)", topic)
            return True

    def register_consumer(self, topic: str, group_id: str, handler: Callable[[Dict[str, Any]], None]):
        """Đăng ký một consumer thread lắng nghe một topic."""
        if not (self.enabled and KAFKA_LIB_AVAILABLE):
            logger.info("Bỏ qua chạy background consumer thực tế cho topic %s (Kafka disabled/unavailable)", topic)
            return

        def _worker():
            logger.info("Bắt đầu Consumer Worker cho topic %s (Group: %s)", topic, group_id)
            try:
                consumer = KafkaConsumer(
                    topic,
                    bootstrap_servers=self.bootstrap_servers,
                    group_id=group_id,
                    auto_offset_reset="earliest",
                    enable_auto_commit=True,
                    value_deserializer=lambda m: json.loads(m.decode("utf-8")),
                    consumer_timeout_ms=2000,
                )
                while self.running:
                    try:
                        records = consumer.poll(timeout_ms=1000)
                        for tp, msgs in records.items():
                            for msg in msgs:
                                logger.info("[KAFKA RECV] Topic: %s | Offset: %d", topic, msg.offset)
                                handler(msg.value)
                    except Exception as e:
                        if self.running:
                            logger.error("Lỗi khi poll Kafka topic %s: %s", topic, e)
                            time.sleep(2)
                consumer.close()
            except Exception as ex:
                logger.warning("Không thể kết nối Consumer tới Kafka cho topic %s: %s", topic, ex)

        t = threading.Thread(target=_worker, daemon=True, name=f"kafka-consumer-{topic}")
        self.consumers.append(t)

    def start(self):
        """Khởi động toàn bộ các consumer thread."""
        self.running = True
        for t in self.consumers:
            if not t.is_alive():
                t.start()

    def stop(self):
        """Dừng các consumer và producer."""
        self.running = False
        if self.producer:
            try:
                self.producer.close()
            except Exception:
                pass


# Singleton instance toàn cục
_bus_instance: Optional[KafkaEventBus] = None

def get_event_bus() -> KafkaEventBus:
    global _bus_instance
    if _bus_instance is None:
        _bus_instance = KafkaEventBus()
    return _bus_instance
