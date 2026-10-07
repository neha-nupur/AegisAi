CREATE TABLE organizations (
    organization_id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(150) NOT NULL,
    plan VARCHAR(50) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
    user_id INT PRIMARY KEY AUTO_INCREMENT,
    organization_id INT NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(organization_id)
);

CREATE TABLE service_accounts (
    service_account_id INT PRIMARY KEY AUTO_INCREMENT,
    organization_id INT NOT NULL,
    name VARCHAR(150) NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    permissions TEXT,                  
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(organization_id)
);


CREATE TABLE scanner_results (
    scan_id INT PRIMARY KEY AUTO_INCREMENT,
    request_id INT NOT NULL,        
    category VARCHAR(50) NOT NULL,    
    action_taken VARCHAR(20) NOT NULL,      
    field_path VARCHAR(100),          
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE ai_requests (
    request_id INT PRIMARY KEY AUTO_INCREMENT,
    organization_id INT NOT NULL,  
    requester_id INT NOT NULL,   
    idempotency_key VARCHAR(255) NOT NULL,
    status VARCHAR(40) NOT NULL,
    model_id INT,       
    trace_id VARCHAR(100),     
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_org_idempotency (organization_id, idempotency_key)
);


CREATE TABLE policies (
    policy_id INT PRIMARY KEY AUTO_INCREMENT,
    organization_id INT NOT NULL,  
    name VARCHAR(150) NOT NULL,
    version INT NOT NULL DEFAULT 1,
    rules_json TEXT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE approvals (
    approval_id INT PRIMARY KEY AUTO_INCREMENT,
    request_id INT NOT NULL,   
    approver_id INT NOT NULL,    
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    reason VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP NULL
);


CREATE TABLE providers (
    provider_id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    base_url VARCHAR(500) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'healthy',
    circuit_state VARCHAR(30) NOT NULL DEFAULT 'closed',
    config_reference VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE models (
    model_id INT PRIMARY KEY AUTO_INCREMENT,
    provider_id INT NOT NULL,
    name VARCHAR(150) NOT NULL,
    type VARCHAR(50) NOT NULL,
    sensitivity_level VARCHAR(50),
    cost_metadata TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (provider_id) REFERENCES providers(provider_id)
);


CREATE TABLE security_events (
    security_event_id INT PRIMARY KEY AUTO_INCREMENT,
    organization_id INT NOT NULL,  
    type VARCHAR(100) NOT NULL,
    severity VARCHAR(30) NOT NULL,
    request_id INT,              
    trace_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE request_traces (
    trace_id VARCHAR(100) PRIMARY KEY,
    request_id INT NOT NULL,            
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE trace_events (
    trace_event_id INT PRIMARY KEY AUTO_INCREMENT,
    trace_id VARCHAR(100) NOT NULL,
    stage VARCHAR(50) NOT NULL,   
    status VARCHAR(30) NOT NULL,
    detail VARCHAR(255),
    latency_ms INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (trace_id) REFERENCES request_traces(trace_id)
);

CREATE TABLE provider_interactions (
    provider_interaction_id INT PRIMARY KEY AUTO_INCREMENT,
    request_id INT NOT NULL,       
    provider_id INT NOT NULL,       
    model_id INT,                 
    latency_ms INT,
    status VARCHAR(30) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE audit_events (
    audit_event_id INT PRIMARY KEY AUTO_INCREMENT,
    organization_id INT NOT NULL,  
    actor_id INT,                
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
