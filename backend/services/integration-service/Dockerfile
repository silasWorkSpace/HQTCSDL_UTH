# integration-service — multi-stage build, chạy bằng Java 21 JRE
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /build
COPY . .
RUN mvn -f pom.xml -pl services/integration-service -am -q package -DskipTests

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=build /build/services/integration-service/target/*.jar app.jar

ENV PORT=8082
EXPOSE 8082
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
