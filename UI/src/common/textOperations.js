export const capitalizeText = (str) => {
    let capitalizedString;
    if(str) {

        const words = str.split(" ");
    
        for (let i = 0; i < words.length; i++) {
            words[i] = words[i][0].toUpperCase() + words[i].substr(1);
        }
    
        capitalizedString = words.join(" ");
    }
    else {
        capitalizedString = ""
    }
    return capitalizedString;
}

export const getFirstTwoLetters = (str) => {
    return String(str.match(/\b(\w)/g).join("")).toUpperCase().slice(0, 2);
}

export const removeExtraSpaces = (str) => {
    return String(str).replace(/\s+/g, ' ').trim()
}