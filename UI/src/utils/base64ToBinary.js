// utils.js

export const base64ToBinary = (base64Data) => {
  const binaryString = atob(base64Data);
  const binaryLength = binaryString.length;
  const bytes = new Uint8Array(binaryLength);
  for (let i = 0; i < binaryLength; i++) {
      bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};
