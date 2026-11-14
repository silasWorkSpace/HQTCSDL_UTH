# governance-service — multi-stage build, chạy bằng Java 21 JRE
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /build
COPY . .
RUN mvn -f pom.xml -pl services/governance-service -am -q package -DskipTests

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=build /build/services/governance-service/target/*.jar app.jar

ENV PORT=8085
EXPOSE 8085
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
