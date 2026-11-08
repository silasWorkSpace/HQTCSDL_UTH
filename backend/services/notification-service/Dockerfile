# notification-service — multi-stage build, chạy bằng Java 21 JRE.
# Build từ thư mục backend/ (context là backend/):
#   docker build -f services/notification-service/Dockerfile -t livingdocs/notification-service backend
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /build
COPY . .
RUN mvn -f pom.xml -pl services/notification-service -am -q package -DskipTests

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=build /build/services/notification-service/target/*.jar app.jar
EXPOSE 8086
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
