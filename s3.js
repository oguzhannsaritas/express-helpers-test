const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');

const s3 = new S3Client({
    region: "eu-central-1",
    credentials: {
        accessKeyId: "YOUR KEY ID",
        secretAccessKey: "YOUR KEY"
    }
});

const albumBucketName = "test-panel-stroge";  // Bucket adı

async function addPhoto(fileBuffer, fileName, albumName = 'images') {
    try {
        const albumPhotosKey = encodeURIComponent(albumName) + "/";
        const photoKey = albumPhotosKey + fileName;

        const params = {
            Bucket: albumBucketName,
            Key: photoKey,  // S3'deki dosya anahtarı
            Body: fileBuffer,  // Buffer olarak gelen dosya içeriği
            ContentDisposition: 'inline',
            ContentType: 'image/png'  // Ekran görüntüsünün PNG olduğunu varsayıyoruz
        };

        const command = new PutObjectCommand(params);
        await s3.send(command);
        console.log(`Fotoğraf başarıyla yüklendi: https://${albumBucketName}.s3.eu-central-1.amazonaws.com/${photoKey}`);
    } catch (error) {
        console.log("Dosya yükleme sırasında bir hata oluştu:", error);
    }
}

module.exports = { addPhoto };