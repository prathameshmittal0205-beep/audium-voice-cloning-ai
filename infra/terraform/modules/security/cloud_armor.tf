resource "google_compute_security_policy" "audium_armor_policy" {
  name        = "${var.env}-audium-armor-policy"
  description = "Cloud Armor policy for Audium Cloud Run ingress"

  # Basic DDoS and default deny-all / allow-all
  # Default rule must be at the lowest priority (highest number)
  rule {
    action   = "allow"
    priority = "2147483647"
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }
    description = "Default allow"
  }

  # Rate limiting per IP
  rule {
    action   = "throttle"
    priority = 100
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }
    rate_limit_options {
      conform_action = "allow"
      exceed_action  = "deny(429)"
      enforce_on_key = "IP"
      rate_limit_threshold {
        count        = 1000
        interval_sec = 60
      }
    }
    description = "Rate Limit 1000 requests per minute per IP"
  }

  # Pre-configured WAF rules for OWASP (SQLi, XSS, etc)
  rule {
    action   = "deny(403)"
    priority = 1000
    match {
      expr {
        expression = "evaluatePreconfiguredExpr('sqli-stable')"
      }
    }
    description = "OWASP SQL Injection Protection"
  }

  rule {
    action   = "deny(403)"
    priority = 1001
    match {
      expr {
        expression = "evaluatePreconfiguredExpr('xss-stable')"
      }
    }
    description = "OWASP XSS Protection"
  }

  # Threat Intelligence / IP Reputation
  rule {
    action   = "deny(403)"
    priority = 2000
    match {
      expr {
        expression = "evaluateThreatIntel('cve-attackers')"
      }
    }
    description = "Deny known CVE attackers"
  }

  # Example Geo Restriction
  rule {
    action   = "deny(403)"
    priority = 3000
    match {
      expr {
        expression = "origin.region_code == 'KP' || origin.region_code == 'IR'"
      }
    }
    description = "Geo Restriction (e.g., North Korea, Iran)"
  }
}

output "cloud_armor_policy_name" {
  value = google_compute_security_policy.audium_armor_policy.name
}
