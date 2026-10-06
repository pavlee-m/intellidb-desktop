export default interface Settings {
  theme: 'light' | 'dark';
  opencode_integration_enabled: boolean;
  opencode_binary: string;
  cursor_cli_integration_enabled: boolean;
  cursor_cli_binary: string;
  sqlmcp_port: number;
}
