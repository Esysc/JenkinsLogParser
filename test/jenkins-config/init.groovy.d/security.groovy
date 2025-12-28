import jenkins.model.*
import hudson.security.*

def instance = Jenkins.getInstance()

// Create admin user
def hudsonRealm = new HudsonPrivateSecurityRealm(false)
hudsonRealm.createAccount("admin", "admin")
instance.setSecurityRealm(hudsonRealm)

// Allow anonymous read access (easier for testing)
def strategy = new FullControlOnceLoggedInAuthorizationStrategy()
strategy.setAllowAnonymousRead(true)
instance.setAuthorizationStrategy(strategy)

// Copy job configurations from mounted directory
def jobsSource = new File("/tmp/jenkins-jobs")
def jobsTarget = new File("/var/jenkins_home/jobs")

if (jobsSource.exists() && jobsSource.isDirectory()) {
    jobsSource.eachDir { jobDir ->
        def targetJobDir = new File(jobsTarget, jobDir.name)
        if (!targetJobDir.exists()) {
            targetJobDir.mkdirs()
            def configFile = new File(jobDir, "config.xml")
            if (configFile.exists()) {
                def targetConfig = new File(targetJobDir, "config.xml")
                targetConfig.text = configFile.text
                println "Created job: ${jobDir.name}"
            }
        }
    }
}

instance.save()
instance.reload()

println "Jenkins security configured - user: admin / password: admin"
