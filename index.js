const express = require("express");
const axios = require("axios");
const app = express();
app.use(express.json());

const referenceIds = [5640264805, 8914927540];
const grayOrWhiteColors = [1, 194, 208, 102, 119085916, 119085909]; // more flexible gray/white/brown range

function isGrayOrWhiteSkin(description) {
  try {
    const parts = [
      description.headColorId,
      description.leftArmColorId,
      description.rightArmColorId,
      description.leftLegColorId,
      description.rightLegColorId,
      description.torsoColorId
    ];
    return parts.every(color => grayOrWhiteColors.includes(color));
  } catch (err) {
    console.warn("⚠️ Missing body color info:", err.message || err);
    return false;
  }
}

function compareAvatars(target, reference) {
  try {
    if (target.shirtAssetId !== reference.shirtAssetId) return false;
    if (target.pantsAssetId !== reference.pantsAssetId) return false;

    const accA = [...target.accessoryAssetIds].sort();
    const accB = [...reference.accessoryAssetIds].sort();
    if (JSON.stringify(accA) !== JSON.stringify(accB)) return false;

    if (!isGrayOrWhiteSkin(target)) return false;

    return true;
  } catch (err) {
    console.error("❌ Error comparing avatars:", err.message || err);
    return false;
  }
}

async function getAvatar(userId) {
  try {
    const res = await axios.get(`https://avatar.roblox.com/v1/users/${userId}/avatar`);
    return {
      shirtAssetId: res.data.assets.find(a => a.assetType.id === 11)?.id || 0,
      pantsAssetId: res.data.assets.find(a => a.assetType.id === 12)?.id || 0,
      accessoryAssetIds: res.data.assets
        .filter(a => a.assetType.name.toLowerCase().includes("accessory"))
        .map(a => a.id),
      headColorId: res.data.bodyColors?.headColorId || 0,
      torsoColorId: res.data.bodyColors?.torsoColorId || 0,
      leftArmColorId: res.data.bodyColors?.leftArmColorId || 0,
      rightArmColorId: res.data.bodyColors?.rightArmColorId || 0,
      leftLegColorId: res.data.bodyColors?.leftLegColorId || 0,
      rightLegColorId: res.data.bodyColors?.rightLegColorId || 0,
    };
  } catch (err) {
    console.warn(`⚠️ Failed to fetch avatar for userId ${userId}:`, err.message || err);
    return null;
  }
}

app.post("/check-avatar", async (req, res) => {
  const { userId } = req.body;
  if (!userId || typeof userId !== "number") {
    return res.status(400).json({ error: "Missing or invalid userId" });
  }

  try {
    const targetAvatar = await getAvatar(userId);
    if (!targetAvatar) return res.status(500).json({ error: "Failed to get target avatar" });

    for (const refId of referenceIds) {
      const refAvatar = await getAvatar(refId);
      if (!refAvatar) continue;

      const match = compareAvatars(targetAvatar, refAvatar);
      if (match) {
        return res.json({ match: true });
      }
    }

    res.json({ match: false });
  } catch (err) {
    console.error("❌ Server error:", err.message || err);
    res.status(500).json({ error: "Internal server error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Avatar checker running on port ${PORT}`));