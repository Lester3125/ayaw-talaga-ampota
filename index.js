const express = require("express");
const axios = require("axios");
const sharp = require("sharp");
const { PNG } = require("pngjs");
const pixelmatch = require("pixelmatch");

const app = express();
const PORT = process.env.PORT || 3000;

// 👧 Girl bot reference avatar (gray skin tone)
const REFERENCE_USER_ID = 5514808927;

let referenceImage = null;

app.get("/", (req, res) => {
    res.send("🟢 Girl Image Kicker (Relaxed Grayscale Match) is Running");
});

async function fetchAvatarHeadshot(userId) {
    const url = `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`;
    const meta = await axios.get(url);
    const imageURL = meta.data.data[0].imageUrl;
    const imageBuffer = await axios.get(imageURL, { responseType: "arraybuffer" });
    return imageBuffer.data;
}

function compareImages(refImg, targetImg, regionStart, regionEnd, threshold = 0.3, maxDiff = 0.2) {
    const width = refImg.width;
    const height = regionEnd - regionStart;

    const refRegion = new PNG({ width, height });
    const targetRegion = new PNG({ width, height });

    for (let y = regionStart; y < regionEnd; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            const ri = ((y - regionStart) * width + x) * 4;
            for (let c = 0; c < 4; c++) {
                refRegion.data[ri + c] = refImg.data[i + c];
                targetRegion.data[ri + c] = targetImg.data[i + c];
            }
        }
    }

    const diffPixels = pixelmatch(
        refRegion.data,
        targetRegion.data,
        null,
        width,
        height,
        { threshold }
    );

    const diffRatio = diffPixels / (width * height);
    return diffRatio < maxDiff;
}

async function isCloneAvatar(targetBuffer) {
    const [refGray, targetGray] = await Promise.all([
        sharp(referenceImage).grayscale().png().toBuffer(),
        sharp(targetBuffer).grayscale().png().toBuffer()
    ]);

    const refPNG = PNG.sync.read(refGray);
    const targetPNG = PNG.sync.read(targetGray);

    const matchHair = compareImages(refPNG, targetPNG, 0, 50, 0.3, 0.2);
    const matchShirt = compareImages(refPNG, targetPNG, 50, 100, 0.3, 0.2);
    const matchPants = compareImages(refPNG, targetPNG, 100, 150, 0.3, 0.2);

    return matchHair && matchShirt && matchPants;
}

app.get("/compare/:userid", async (req, res) => {
    const userId = req.params.userid;

    try {
        const targetImage = await fetchAvatarHeadshot(userId);
        const isMatch = await isCloneAvatar(targetImage);
        res.json({ match: isMatch });
    } catch (err) {
        console.error("❌ Error during comparison:", err.message);
        res.status(500).json({ error: "Comparison failed", details: err.message });
    }
});

app.listen(PORT, async () => {
    console.log(`✅ Girl Kicker (Relaxed Match) running on port ${PORT}`);
    try {
        referenceImage = await fetchAvatarHeadshot(REFERENCE_USER_ID);
        console.log("✅ Reference avatar loaded (grayscale ready)");
    } catch (err) {
        console.error("❌ Failed to load reference image:", err.message);
    }
});
