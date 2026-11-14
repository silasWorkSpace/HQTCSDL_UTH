FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY target/*.jar app.jar
ENV PORT=8085
EXPOSE 8085
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
