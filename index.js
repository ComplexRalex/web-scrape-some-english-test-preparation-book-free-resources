import https from 'node:https';
import path from 'node:path';
import fs from 'node:fs';
import puppeteer from "puppeteer";

//
// This code was made for personal use to easily download resources
// for an English test preparation book I bought last year.
//
// I did this as practice for web scraping, as well as to have fun
// while getting content to prepare for my tests.
//
// I tried as much as possible to hide any information related to the
// page where I found this.
//
// It's important to clarify that this book's complementary media
// content (such as audio tracks) is provided completely FREE on their
// official website. For that reason, I proceeded with this script
// anyway, since the only purpose of the page is to download those
// media files.
//

process.loadEnvFile('.env');
const URL = process.env.WEB_PAGE;

const saveFile = async (source, filename, successCB, errorCB) => {
    return new Promise((resolve, reject) => {
        const filepath = path.join(process.cwd(), 'data', filename);
        const file = fs.createWriteStream(filepath);
        const request = https.get(source, (response) => {
            response.pipe(file);
        });

        file.on("finish", () => {
            file.close();
            successCB?.(filepath);
            resolve(filepath);
        });
        file.on("error", (err) => {
            fs.unlinkSync(filepath);
            const error = `Error while storing file ${filepath}: ${err}`;
            errorCB?.();
            reject(error);
        });
        request.on("error", (err) => {
            fs.unlinkSync(filepath);
            const error = `Error while requesting source ${source}: ${err}`;
            errorCB?.(error);
            reject(error);
        });
    });
}

const scrape = async () => {
    const browser = await puppeteer.launch({
        // headless: false,
        // defaultViewport: {width: 1024, height: 1024},
    });

    console.log("Starting page...");
    const page = await browser.newPage();

    await page.goto(URL);
    console.log(`Navigating to ${page.url()}...`);

    await Promise.all([
        page.waitForNavigation(),
        page.locator('.l-main .l-content h2 ::-p-text(Student Resources)')
            .click(),
    ]);
    console.log(`Navigating to ${page.url()}...`);

    await Promise.all([
        page.waitForNavigation(),
        page.locator('.l-main .l-content h2 ::-p-text(Audio)')
            .click(),
    ]);
    console.log(`Navigating to ${page.url()}...`);

    const optionsLevel1 = await page.$$eval('.form-item-level2-select select option', (options) => {
        return Array.from(options)
            .filter((option) => Number(option.value) > 0)
            .map((option) => ({
                value: Number(option.value),
                label: option.textContent,
            }));
    });

    // console.debug("Current options:");
    // console.debug(optionsLevel1);

    for (const optionLevel1 of optionsLevel1) {
        console.log(`Fetching section ${optionLevel1.label}...`);

        await page.select(".form-item-level2-select select", optionLevel1.value.toString());
        await page.waitForSelector('.form-item-audio-select select');

        const optionsLevel2 = await page.$$eval('.form-item-audio-select select option', (options) => {
            return Array.from(options)
                .filter((option) => Number(option.value) > 0)
                .map((option) => ({
                    value: Number(option.value),
                    label: option.textContent,
                }));
        });

        // console.debug(`Second level options for ${optionLevel1.label}`);
        // console.debug(optionsLevel2);

        const promises = [];

        for (const optionLevel2 of optionsLevel2) {
            await page.select(".form-item-audio-select select", optionLevel2.value.toString());
            await page.waitForSelector('.file.file-audio audio');

            const source = await page.$eval('.file.file-audio audio source', (source) => {
                return source.src;
            });

            promises.push(saveFile(
                source,
                optionLevel2.label,
                (filepath) => {
                    console.log(`Media file ${filepath} saved successfully.`);
                },
                (err) => {
                    console.log(`An error occurred while saving media ${optionLevel2.label}: ${err}.`);
                }
            ));
        }

        await Promise.all(promises);
    }

    await browser.close();
    console.log("Done.");
}

scrape();
