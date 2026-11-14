FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY target/*.jar app.jar
ENV PORT=8083
EXPOSE 8083
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
