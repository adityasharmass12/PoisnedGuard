import re
from urllib.parse import urlparse

def get_url_features(url):
    """
    Extract phishing detection features from URL.
    Uses heuristic rules instead of ML for accurate classification.
    """
    
    try:
        parsed = urlparse(url)
        domain = parsed.netloc.lower()
        path = parsed.path.lower()
        full_url = url.lower()
    except:
        return {"error": 1}
    
    # Phishing Risk Score (0-100, higher = more phishing)
    risk_score = 0
    reasons = []
    
    # ===== LEGITIMATE DOMAIN CHECK =====
    # Whitelist of known safe domains
    safe_domains = {
        'github.com', 'google.com', 'facebook.com', 'twitter.com', 
        'linkedin.com', 'stackoverflow.com', 'reddit.com', 'wikipedia.org',
        'youtube.com', 'amazon.com', 'ebay.com', 'paypal.com', 'microsoft.com',
        'apple.com', 'adobe.com', 'dropbox.com', 'slack.com', 'gmail.com',
        'outlook.com', 'yahoo.com', 'protonmail.com', 'github.io'
    }
    
    # Check if domain is in safe list
    is_safe = any(domain.endswith(safe) or domain == safe for safe in safe_domains)
    if is_safe:
        return {"is_phishing": False, "confidence": 0.95, "reasons": ["Verified trusted domain"]}
    
    # ===== RED FLAG CHECKS =====
    
    # 1. IP address instead of domain name
    if re.search(r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}', domain):
        risk_score += 30
        reasons.append("URL uses IP address instead of domain")
    
    # 2. Multiple @ symbols (credential stuffing)
    if full_url.count('@') > 1:
        risk_score += 25
        reasons.append("Multiple @ symbols (credential harvesting)")
    
    # 3. Suspicious port numbers
    if ':' in domain:
        try:
            port = int(domain.split(':')[1])
            if port not in [80, 443, 8080, 8443]:
                risk_score += 15
                reasons.append(f"Suspicious port {port}")
        except:
            pass
    
    # 4. URL shortener services
    shorteners = ['bit.ly', 'goo.gl', 't.co', 'tinyurl.com', 'ow.ly', 'short.link']
    if any(s in domain for s in shorteners):
        risk_score += 20
        reasons.append("URL shortened (obfuscation)")
    
    # 5. Typosquatting common domains
    typo_patterns = {
        'goog': 'google.com',
        'faceb': 'facebook.com',
        'tw1tt': 'twitter.com',
        'amaz0n': 'amazon.com',
        'paypa1': 'paypal.com'
    }
    for pattern, legit in typo_patterns.items():
        if pattern in domain and legit not in domain:
            risk_score += 20
            reasons.append(f"Possible typosquatting of {legit}")
    
    # 6. Suspicious keywords in URL
    suspicious_keywords = [
        'verify', 'confirm', 'update', 'urgent', 'account', 'secure',
        'login', 'signin', 'payment', 'billing', 'suspended', 'validate'
    ]
    keyword_count = sum(1 for keyword in suspicious_keywords if keyword in full_url)
    if keyword_count >= 2:
        risk_score += 15 * keyword_count
        reasons.append(f"Multiple suspicious keywords ({keyword_count})")
    
    # 7. Excessive special characters
    special_chars = len(re.findall(r'[!@#$%^&*()+=\[\]{};:\'",<>?/\\|-]', full_url))
    if special_chars > 10:
        risk_score += 15
        reasons.append("Excessive special characters")
    
    # 8. Very long URL
    if len(full_url) > 100:
        risk_score += 10
        reasons.append("Very long URL (potential obfuscation)")
    
    # 9. HTTPS is present (slightly reduces risk)
    if url.startswith('https'):
        risk_score = max(0, risk_score - 5)
    
    # 10. Multiple dots in domain (subdomain stacking)
    dot_count = domain.count('.')
    if dot_count > 3:
        risk_score += 10
        reasons.append("Excessive subdomains")
    
    # Normalize score to 0-100
    risk_score = max(0, min(100, risk_score))
    
    # Classification: > 40 is phishing
    is_phishing = risk_score > 40
    confidence = risk_score / 100.0
    
    return {
        "is_phishing": is_phishing,
        "confidence": round(confidence, 2),
        "risk_score": risk_score,
        "reasons": reasons
    }