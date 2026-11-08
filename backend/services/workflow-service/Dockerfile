# workflow-service — multi-stage build, chạy bằng java 21 JRE
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /build
COPY ../../libs /build/libs
COPY ../../pom.xml /build/pom.xml
COPY pom.xml /build/services/workflow-service/pom.xml
COPY src /build/services/workflow-service/src
RUN mvn -f /build/pom.xml -pl services/workflow-service -am -q package -DskipTests

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=build /build/services/workflow-service/target/*.jar app.jar
EXPOSE 8084
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
