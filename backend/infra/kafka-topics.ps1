# Tao 5 topic Kafka cua LivingDocs (chay sau khi .\db.ps1 up). Chay lai nhieu lan van an toan.
$ErrorActionPreference = "Continue"
$container = "livingdocs-kafka"
$bootstrap = "localhost:19092"
$topics = "ld.source-events", "ld.ai-jobs", "ld.ai-results", "ld.notifications", "ld.ai-jobs.dlq"

foreach ($t in $topics) {
    docker exec $container /opt/kafka/bin/kafka-topics.sh --bootstrap-server $bootstrap --create --if-not-exists --topic $t --partitions 3 --replication-factor 1
}
Write-Host "Danh sach topic hien co:" -ForegroundColor Cyan
docker exec $container /opt/kafka/bin/kafka-topics.sh --bootstrap-server $bootstrap --list
