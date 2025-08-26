SELECT c.id
FROM users u
JOIN chats c ON u.id = c.user_id
WHERE u.id = ?
  AND c.id = ?;
