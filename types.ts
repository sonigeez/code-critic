export interface GitHubPushEvent {
	ref: string;
	repository: {
		full_name: string;
	};
	head_commit: {
		id: string;
		message: string;
	};
	before: string;
	after: string;
}