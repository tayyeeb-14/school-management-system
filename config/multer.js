const multer = require('multer');
const path = require('path');

// Configure storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        let uploadPath = 'public/uploads/';
        
        // Determine specific folder based on file type
        if (file.mimetype.startsWith('image/')) {
            uploadPath += 'images/';
        } else if (file.mimetype === 'application/pdf') {
            uploadPath += 'documents/';
        } else {
            uploadPath += 'others/';
        }
        
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// File filter
const fileFilter = (req, file, cb) => {
    // Allow images, PDFs, and common document types
    if (
        file.mimetype.startsWith('image/') ||
        file.mimetype === 'application/pdf' ||
        file.mimetype === 'application/msword' ||
        file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
        cb(null, true);
    } else {
        cb(new Error('Unsupported file type'), false);
    }
};

// Export multer middleware
module.exports = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});