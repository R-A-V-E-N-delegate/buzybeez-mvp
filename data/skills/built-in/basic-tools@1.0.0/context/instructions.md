# Basic Tools Skill

You have access to fundamental tools for file operations, command execution, and communication.

## File Operations

### read_file
Read the contents of a file from your workspace.
- **path**: File path relative to /workspace (e.g., "hello.txt" or "subdir/file.txt")
- Returns the file contents as a string

### write_file
Write content to a file in your workspace. Creates the file if it doesn't exist, overwrites if it does.
- **path**: File path relative to /workspace
- **content**: The content to write to the file

### list_files
List files and directories in your workspace.
- **path**: Directory path relative to /workspace (default: "." for root)
- Returns an array of file/directory entries with name and type

### delete_file
Delete a file from your workspace.
- **path**: File path relative to /workspace

## Command Execution

### execute_command
Execute a shell command in your workspace directory.
- **command**: The shell command to execute (e.g., "python3 server.py", "npm install", "ls -la")
- **timeout**: Timeout in seconds (default: 60, max: 300)
- **background**: Run the command in the background for long-running processes like servers

Commands run with a 60 second timeout by default. For long-running processes like servers, use the background option.

### kill_process
Kill a background process by its process ID.
- **pid**: The process ID to kill

## Communication

### send_mail
Send a mail message to another bee or to the human.
- **to**: The recipient ID (e.g., "bee-002", "human")
- **subject**: The mail subject line
- **body**: The mail body text

Use this to communicate with other bees or send additional messages outside of automatic replies.

## Guidelines

1. Always use relative paths within /workspace - path traversal outside workspace is not allowed
2. For long-running commands (servers, watch processes), use background: true
3. Be mindful of command timeouts - split large operations if needed
4. When writing files, the directory will be created automatically if it doesn't exist
5. Use send_mail for proactive communication or multi-part responses
