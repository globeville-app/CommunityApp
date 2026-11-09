"""
The DigitalOcean app specs (.do/app.yaml, .do/staging.yaml) only use fields
App Platform accepts. It refuses the whole spec on the first unknown field
(e.g. `domains` inside a service instead of at the top), which is only found
when the owner pastes it. Field lists from DigitalOcean's godo library
(apps.gen.go); add to them only from there.
"""

import yaml
from django.test import SimpleTestCase

from config.settings import REPO_ROOT

ALLOWED = {
    "app": {"name", "services", "static_sites", "workers", "jobs", "functions", "databases", "domains", "region",
            "envs", "alerts", "ingress", "egress", "features", "maintenance", "vpc", "disable_edge_cache",
            "disable_email_obfuscation", "enhanced_threat_control_enabled"},
    "service": {"name", "git", "github", "image", "gitlab", "bitbucket", "dockerfile_path", "build_command",
                "run_command", "source_dir", "environment_slug", "envs", "instance_size_slug", "instance_count",
                "autoscaling", "http_port", "protocol", "routes", "health_check", "cors", "internal_ports", "alerts",
                "log_destinations", "termination", "inactivity_sleep", "liveness_health_check"},
    "job": {"name", "git", "github", "image", "gitlab", "bitbucket", "dockerfile_path", "build_command",
            "run_command", "source_dir", "environment_slug", "envs", "instance_size_slug", "instance_count", "kind",
            "schedule", "alerts", "log_destinations", "termination", "timeout"},
    "database": {"name", "engine", "version", "size", "num_nodes", "production", "cluster_name", "db_name", "db_user"},
    "env": {"key", "value", "scope", "type"},
    "alert": {"rule", "disabled", "operator", "value", "window"},
    "domain": {"domain", "type", "wildcard", "zone", "minimum_tls_version"},
    "github": {"repo", "branch", "deploy_on_push"},
    "schedule": {"cron", "time_zone"},
}


class DigitalOceanSpecTests(SimpleTestCase):
    def unknown(self, spec):
        found = []

        def check(obj, kind, where):
            found.extend(f"{where}.{key}" for key in obj if key not in ALLOWED[kind])

        check(spec, "app", "top")
        for env in spec.get("envs", []):
            check(env, "env", "envs")
        for alert in spec.get("alerts", []):
            check(alert, "alert", "alerts")
        for domain in spec.get("domains", []):
            check(domain, "domain", "domains")
        for kind, components in (("service", spec.get("services", [])), ("job", spec.get("jobs", []))):
            for component in components:
                name = component["name"]
                check(component, kind, name)
                check(component.get("github", {}), "github", f"{name}.github")
                check(component.get("schedule", {}), "schedule", f"{name}.schedule")
                for env in component.get("envs", []):
                    check(env, "env", f"{name}.envs")
                for alert in component.get("alerts", []):
                    check(alert, "alert", f"{name}.alerts")
        for database in spec.get("databases", []):
            check(database, "database", "databases")
        return found

    def test_specs_use_only_fields_app_platform_accepts(self):
        for name in ("app.yaml", "staging.yaml"):
            with self.subTest(spec=name):
                spec = yaml.safe_load((REPO_ROOT / ".do" / name).read_text())
                self.assertEqual(self.unknown(spec), [])
                self.assertTrue(spec["domains"], "domains are listed at the top of the spec")

    def test_production_spec_needs_only_the_six_secrets(self):
        spec = yaml.safe_load((REPO_ROOT / ".do" / "app.yaml").read_text())
        placeholders = sorted(e["key"] for e in spec["envs"] if "CHANGE_ME" in str(e.get("value", "")))
        self.assertEqual(
            placeholders,
            ["ADMIN_URL", "DJANGO_SECRET_KEY", "EMAIL_HOST_PASSWORD", "EMAIL_HOST_USER", "SPACES_KEY", "SPACES_SECRET"],
        )
        for component in spec["services"] + spec["jobs"]:
            self.assertNotIn("CHANGE_ME", str(component), component["name"])
