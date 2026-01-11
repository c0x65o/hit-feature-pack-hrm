/**
 * vCard generation utility
 * Generates vCard 3.0 format files for contacts/employees
 */
/**
 * Escape special characters in vCard values
 */
function escapeVCardValue(value) {
    return value
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\n/g, '\\n');
}
/**
 * Generate a vCard 3.0 string from contact data
 */
export function generateVCard(data) {
    const lines = ['BEGIN:VCARD', 'VERSION:3.0'];
    // Full name (required in vCard)
    const fullName = data.fullName?.trim()
        || [data.firstName, data.lastName].filter(Boolean).join(' ').trim()
        || 'Unknown';
    lines.push(`FN:${escapeVCardValue(fullName)}`);
    // Structured name: N:Last;First;Middle;Prefix;Suffix
    const lastName = data.lastName?.trim() || '';
    const firstName = data.firstName?.trim() || '';
    lines.push(`N:${escapeVCardValue(lastName)};${escapeVCardValue(firstName)};;;`);
    // Email
    if (data.email?.trim()) {
        lines.push(`EMAIL;TYPE=INTERNET:${escapeVCardValue(data.email.trim())}`);
    }
    // Phone
    if (data.phone?.trim()) {
        lines.push(`TEL;TYPE=VOICE:${escapeVCardValue(data.phone.trim())}`);
    }
    // Title
    if (data.title?.trim()) {
        lines.push(`TITLE:${escapeVCardValue(data.title.trim())}`);
    }
    // Organization
    if (data.organization?.trim()) {
        lines.push(`ORG:${escapeVCardValue(data.organization.trim())}`);
    }
    // Address: ADR:PO Box;Extended;Street;City;State;Postal;Country
    const hasAddress = data.address1 || data.city || data.state || data.postalCode || data.country;
    if (hasAddress) {
        const street = [data.address1, data.address2].filter(Boolean).join(', ');
        const addrParts = [
            '', // PO Box
            '', // Extended address
            escapeVCardValue(street || ''),
            escapeVCardValue(data.city?.trim() || ''),
            escapeVCardValue(data.state?.trim() || ''),
            escapeVCardValue(data.postalCode?.trim() || ''),
            escapeVCardValue(data.country?.trim() || ''),
        ];
        lines.push(`ADR;TYPE=WORK:${addrParts.join(';')}`);
    }
    // Photo - handle base64 data URLs
    if (data.photoUrl?.trim()) {
        const photoUrl = data.photoUrl.trim();
        // Parse data URL format: data:image/jpeg;base64,/9j/4AAQ...
        const dataUrlMatch = photoUrl.match(/^data:image\/(\w+);base64,(.+)$/);
        if (dataUrlMatch) {
            const imageType = dataUrlMatch[1].toUpperCase();
            const base64Data = dataUrlMatch[2];
            // vCard 3.0 photo format with line folding (lines should be max 75 chars)
            lines.push(`PHOTO;ENCODING=b;TYPE=${imageType}:${base64Data}`);
        }
        else if (photoUrl.startsWith('http://') || photoUrl.startsWith('https://')) {
            // URL-based photo
            lines.push(`PHOTO;VALUE=URI:${photoUrl}`);
        }
    }
    lines.push('END:VCARD');
    return lines.join('\r\n');
}
/**
 * Trigger a file download in the browser
 */
export function downloadVCard(data, filename) {
    const vcard = generateVCard(data);
    const blob = new Blob([vcard], { type: 'text/vcard;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `${data.fullName || data.firstName || 'contact'}.vcf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
