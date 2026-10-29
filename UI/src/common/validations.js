const NAME_REGEX = /^[a-zA-Z]*(([',. -][a-zA-Z])?[a-zA-Z]*)*$/;
// const EMAIL_REGEX = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;
const EMAIL_REGEX = /^[\w._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})?$/;

// const CONTACT_REGEX = /^(\[\-\s]?)?[0]?(91)?[789]\d{9}$/;
// const CONTACT_REGEX = /^(\+?91)?[789]\d{9,19}$/;
const CONTACT_REGEX = /^(\+?\d{1,4}?)?[789]\d{9,19}$/;



export const isValidName = (name) => {
    return NAME_REGEX.test(String(name))
}

export const isValidEmail = (email) => {
    return EMAIL_REGEX.test(String(email))
}

export const isValidContact = (contact) => {
    return CONTACT_REGEX.test(String(contact))
}

export const isValidPassword = (password) => { const passwordLengthValid = password.length >= 9; const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password); const hasAlphanumeric = /[a-zA-Z]/.test(password) && /\d/.test(password); return (passwordLengthValid && hasSpecialChar && hasAlphanumeric); };