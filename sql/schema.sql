
-- Run this in your Azure SQL database
CREATE TABLE Users(
  id INT IDENTITY PRIMARY KEY,
  email NVARCHAR(256) UNIQUE NOT NULL,
  pwd_hash NVARCHAR(256) NOT NULL,
  full_name NVARCHAR(200) NULL,
  phone NVARCHAR(40) NULL,
  is_operator BIT NOT NULL DEFAULT 0,
  subscription_tier NVARCHAR(40) NULL,
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE Plans(
  id INT IDENTITY PRIMARY KEY,
  name NVARCHAR(40) UNIQUE NOT NULL,
  quota_pages INT NOT NULL
);
INSERT INTO Plans(name, quota_pages) VALUES ('Basic',100),('Standard',250),('Pro',600);

CREATE TABLE Subscriptions(
  id INT IDENTITY PRIMARY KEY,
  user_id INT NOT NULL REFERENCES Users(id),
  plan_id INT NOT NULL REFERENCES Plans(id),
  pages_remaining INT NOT NULL,
  active BIT NOT NULL DEFAULT 1,
  start_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE Jobs(
  id INT IDENTITY PRIMARY KEY,
  user_id INT NOT NULL REFERENCES Users(id),
  file_name NVARCHAR(260) NOT NULL,
  storage_url NVARCHAR(2048) NOT NULL,
  pages INT NOT NULL,
  color BIT NOT NULL,
  duplex BIT NOT NULL,
  status NVARCHAR(40) NOT NULL DEFAULT 'Queued',
  pickup_code VARCHAR(12) NULL,
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
