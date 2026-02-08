const capWord = async (word: string) => {
    const capLetter = word.slice(0, 1);
    const restWord = word.slice(1);
    const slashWord = word.split("/");

    if (slashWord.length > 1) {
        const newWords = [];
        for await (const newWord of slashWord) {
            const thisWord = await capWord(newWord);
            newWords.push(thisWord);
        }

        return newWords.join(" / ");
    }
    return `${capLetter.toUpperCase()}${restWord}`;
};

export const toTitleCase = async(fullTitle: string) => {
    const titleWords = fullTitle.split(" ");
    const workingTitle = [];

    for await (const word of titleWords) {
        workingTitle.push(await capWord(word));
    }

    return workingTitle.join(" ");
};