export interface NotificationProvider {
    send(parentId: string, message: string): Promise<void>;
}

export class ConsoleNotificationProvider implements NotificationProvider {
    async send(parentId: string, message: string): Promise<void> {
        console.log(`[notification] to parent ${parentId}: ${message}`);
    }
}
