const DICOM_MIME_TYPES = new Set(['application/dicom', 'image/dicom'])

export const getFileExtension = (name: string): string => {
    const extension = name.split('.').pop()
    return extension && extension !== name ? extension.toLowerCase() : ''
}

export const isDicomFile = (file: File): boolean => {
    return getFileExtension(file.name) === 'dcm' || DICOM_MIME_TYPES.has(file.type.toLowerCase())
}

const ZIP_MIME_TYPES = new Set(['application/zip', 'application/x-zip-compressed'])

/** Detect common ZIP signatures as well as explicit ZIP names and MIME types. */
export const isZipFile = async (file: File): Promise<boolean> => {
    if (getFileExtension(file.name) === 'zip' || ZIP_MIME_TYPES.has(file.type.toLowerCase())) return true

    const signature = new Uint8Array(await file.slice(0, 4).arrayBuffer())
    return (
        signature.length === 4 &&
        signature[0] === 0x50 &&
        signature[1] === 0x4b &&
        ((signature[2] === 0x03 && signature[3] === 0x04) ||
            (signature[2] === 0x05 && signature[3] === 0x06) ||
            (signature[2] === 0x07 && signature[3] === 0x08))
    )
}
