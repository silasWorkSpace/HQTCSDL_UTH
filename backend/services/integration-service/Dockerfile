FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

COPY target/*.jar app.jar

ENV PORT=8082
ENV SPRING_DATASOURCE_URL=jdbc:sqlserver://localhost:1433;databaseName=livingdocs;trustServerCertificate=true;encrypt=false
ENV SPRING_DATASOURCE_USERNAME=sa
ENV SPRING_DATASOURCE_PASSWORD=Living_Docs_2026!
ENV REDIS_HOST=localhost
ENV REDIS_PORT=6379
ENV KAFKA_BOOTSTRAP_SERVERS=localhost:9092

EXPOSE 8082

ENTRYPOINT ["java", "-jar", "app.jar"]
