SELECT * 
FROM chats 
WHERE user_id = ? 
ORDER BY updated_at desc 
LIMIT ? 
OFFSET ?