// entities/Alert.ts
/**
 * Represents an alert generated by the system.
 */
export interface Alert {
    id: number | string; // Unique identifier for the alert.
    message: string; // The main message of the alert.
    level: 'info' | 'warning' | 'error'; // The severity level of the alert.
    timestamp: string; // When the alert was generated (e.g., ISO string).
    campaignId: string | null; // Optional ID of the campaign related to the alert.
    isDismissed: boolean; // Whether the alert has been dismissed by the user.
    // Add other properties as needed based on your data structure
}
