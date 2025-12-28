FROM jenkins/jenkins:lts-jdk17

# Skip setup wizard
ENV JAVA_OPTS="-Djenkins.install.runSetupWizard=false"

# Install Pipeline plugins
RUN jenkins-plugin-cli --plugins \
    workflow-aggregator \
    workflow-job \
    workflow-cps \
    workflow-basic-steps \
    workflow-durable-task-step \
    pipeline-stage-view \
    pipeline-model-definition \
    git
