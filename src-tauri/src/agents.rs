pub fn detect_agent(name: &str) -> Option<String> {
    match name.to_lowercase().as_str() {
        "codex" | "codex-cli" => Some("Codex".into()),
        "claude" => Some("Claude Code".into()),
        "gemini" => Some("Gemini CLI".into()),
        "opencode" => Some("OpenCode".into()),
        _ => None,
    }
}
