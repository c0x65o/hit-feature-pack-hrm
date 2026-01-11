/**
 * vCard generation utility
 * Generates vCard 3.0 format files for contacts/employees
 */
export interface VCardData {
    firstName?: string | null;
    lastName?: string | null;
    fullName?: string | null;
    email?: string | null;
    phone?: string | null;
    title?: string | null;
    organization?: string | null;
    address1?: string | null;
    address2?: string | null;
    city?: string | null;
    state?: string | null;
    postalCode?: string | null;
    country?: string | null;
    /** Base64 data URL (e.g., "data:image/jpeg;base64,/9j/4AAQ...") or plain base64 string */
    photoUrl?: string | null;
}
/**
 * Generate a vCard 3.0 string from contact data
 */
export declare function generateVCard(data: VCardData): string;
/**
 * Trigger a file download in the browser
 */
export declare function downloadVCard(data: VCardData, filename?: string): void;
//# sourceMappingURL=vcard.d.ts.map