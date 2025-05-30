-- Users table to store user information
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_id TEXT UNIQUE NOT NULL,  -- Auth0 sub/user ID
  email TEXT UNIQUE,
  name TEXT,
  picture TEXT,
  api_key TEXT,
  query_count INT DEFAULT 0,
  last_login TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User settings table
CREATE TABLE user_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL REFERENCES users(auth_id),
  theme TEXT DEFAULT 'light',
  auto_open_sidebar BOOLEAN DEFAULT false,
  ai_model TEXT DEFAULT 'gpt-4o',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Queries table to track user interactions
CREATE TABLE queries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL REFERENCES users(auth_id),
  query_text TEXT NOT NULL,
  response TEXT,
  page_title TEXT,
  page_url TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- indexes for better performance
CREATE INDEX queries_user_id_idx ON queries(user_id);
CREATE INDEX queries_timestamp_idx ON queries(timestamp);
CREATE INDEX queries_user_timestamp_idx ON queries(user_id, timestamp);

-- increment query count
CREATE OR REPLACE FUNCTION increment_query_count(user_auth_id TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE users
  SET query_count = query_count + 1
  WHERE auth_id = user_auth_id; d
END;
$$ LANGUAGE plpgsql; 