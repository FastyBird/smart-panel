/**
 * Base installer interface for platform-specific implementations
 */

export interface InstallOptions {
	/** Service user name */
	user: string;
	/** Data directory path */
	dataDir: string;
	/** HTTP port for the backend */
	port: number;
	/** Skip starting the service after install */
	noStart: boolean;
}

export interface UninstallOptions {
	/** Keep data directory */
	keepData: boolean;
	/** Skip confirmation prompts */
	force: boolean;
}

export interface ServiceStatus {
	/** Whether the service is installed */
	installed: boolean;
	/** Whether the service is currently running */
	running: boolean;
	/** Whether the service is enabled to start on boot */
	enabled: boolean;
	/** Process ID if running */
	pid?: number;
	/** Uptime in seconds if running */
	uptime?: number;
	/** Memory usage in MB if running */
	memoryMB?: number;
	/** Additional status message */
	message?: string;
}

export interface BaseInstaller {
	/** Platform name */
	readonly platform: string;

	/** Check if this installer is compatible with the current system */
	isCompatible(): boolean;

	/** Install the service */
	install(options: InstallOptions): Promise<void>;

	/** Uninstall the service */
	uninstall(options: UninstallOptions): Promise<void>;

	/** Start the service */
	start(): Promise<void>;

	/** Stop the service */
	stop(): Promise<void>;

	/** Restart the service */
	restart(): Promise<void>;

	/** Get service status */
	status(): Promise<ServiceStatus>;

	/** Get service logs */
	logs(options: { follow: boolean; lines: number; since?: string }): Promise<void>;

	/** Run database migrations */
	runMigrations(dataDir: string): Promise<void>;

	/** Check prerequisites */
	checkPrerequisites(): Promise<string[]>;
}
