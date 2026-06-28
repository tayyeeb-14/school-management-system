#!/usr/bin/env node
/**
 * Teacher Module - Phase 3 Implementation Verification
 * Checks all new routes and views
 */

const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(path.join(__dirname, '..'));

const checks = {
    files: [
        'views/teacher/timetable.ejs',
        'views/teacher/my-classes.ejs',
        'views/teacher/profile.ejs',
        'views/teacher/change-password.ejs',
        'views/teacher/check-shift.ejs',
        'views/partials/dashboard-teacher-menu.ejs',
    ],
    routeChecks: [
        { file: 'routes/teacher.js', pattern: "router.get('/timetable'", name: 'My Timetable route' },
        { file: 'routes/teacher.js', pattern: "router.get('/my-classes'", name: 'My Classes route' },
        { file: 'routes/teacher.js', pattern: "router.get('/profile'", name: 'Profile route' },
        { file: 'routes/teacher.js', pattern: "router.post('/profile'", name: 'Profile update route' },
        { file: 'routes/teacher.js', pattern: "router.get('/change-password'", name: 'Change password route' },
        { file: 'routes/teacher.js', pattern: "router.post('/change-password'", name: 'Password update route' },
        { file: 'routes/teacher.js', pattern: "router.get('/check-shift'", name: 'Check shift route' },
        { file: 'routes/teacher.js', pattern: 'const TimetableSlot', name: 'TimetableSlot import' },
        { file: 'routes/teacher.js', pattern: 'const User', name: 'User import' },
        { file: 'routes/teacher.js', pattern: 'function getDayName', name: 'getDayName utility' },
    ],
    menuChecks: [
        { file: 'views/partials/dashboard-teacher-menu.ejs', pattern: "'/teacher/timetable'", name: 'Timetable menu item' },
        { file: 'views/partials/dashboard-teacher-menu.ejs', pattern: "'/teacher/my-classes'", name: 'My Classes menu item' },
        { file: 'views/partials/dashboard-teacher-menu.ejs', pattern: "'/teacher/profile'", name: 'Profile menu item' },
        { file: 'views/partials/dashboard-teacher-menu.ejs', pattern: "'/teacher/check-shift'", name: 'Check In/Out menu item' },
        { file: 'views/partials/dashboard-teacher-menu.ejs', pattern: "'/auth/logout'", name: 'Logout menu item' },
        // These should be removed
        { file: 'views/partials/dashboard-teacher-menu.ejs', pattern: "'/teacher/assignments'", name: 'Assignments menu (should be removed)', shouldNotExist: true },
        { file: 'views/partials/dashboard-teacher-menu.ejs', pattern: "'/teacher/blogs'", name: 'Blogs menu (should be removed)', shouldNotExist: true },
        { file: 'views/partials/dashboard-teacher-menu.ejs', pattern: "'/teacher/attendance'", name: 'Mark Attendance menu (should be removed)', shouldNotExist: true },
    ]
};

let passCount = 0;
let failCount = 0;

console.log('🔍 Teacher Module Phase 3 - Verification Report\n');
console.log('='.repeat(60));

// Check file existence
console.log('\n📁 File Existence Checks:');
checks.files.forEach(file => {
    const fullPath = path.join(projectRoot, file);
    const exists = fs.existsSync(fullPath);
    if (exists) {
        console.log(`  ✅ ${file}`);
        passCount++;
    } else {
        console.log(`  ❌ ${file} - NOT FOUND`);
        failCount++;
    }
});

// Check route patterns
console.log('\n🛣️  Route Implementation Checks:');
checks.routeChecks.forEach(check => {
    const fullPath = path.join(projectRoot, check.file);
    if (!fs.existsSync(fullPath)) {
        console.log(`  ❌ ${check.name} - File not found`);
        failCount++;
        return;
    }
    
    const content = fs.readFileSync(fullPath, 'utf8');
    if (content.includes(check.pattern)) {
        console.log(`  ✅ ${check.name}`);
        passCount++;
    } else {
        console.log(`  ❌ ${check.name} - Pattern not found`);
        failCount++;
    }
});

// Check menu items
console.log('\n🎯 Sidebar Menu Checks:');
checks.menuChecks.forEach(check => {
    const fullPath = path.join(projectRoot, check.file);
    if (!fs.existsSync(fullPath)) {
        console.log(`  ❌ ${check.name} - File not found`);
        failCount++;
        return;
    }
    
    const content = fs.readFileSync(fullPath, 'utf8');
    const hasPattern = content.includes(check.pattern);
    
    if (check.shouldNotExist) {
        if (!hasPattern) {
            console.log(`  ✅ ${check.name}`);
            passCount++;
        } else {
            console.log(`  ❌ ${check.name} - Pattern found but should be removed`);
            failCount++;
        }
    } else {
        if (hasPattern) {
            console.log(`  ✅ ${check.name}`);
            passCount++;
        } else {
            console.log(`  ❌ ${check.name} - Pattern not found`);
            failCount++;
        }
    }
});

// Summary
console.log('\n' + '='.repeat(60));
console.log('\n📊 Verification Summary:');
console.log(`  ✅ Passed: ${passCount}`);
console.log(`  ❌ Failed: ${failCount}`);
console.log(`  Total:  ${passCount + failCount}`);

if (failCount === 0) {
    console.log('\n🎉 All checks passed! Teacher Module Phase 3 implementation is complete.');
    process.exit(0);
} else {
    console.log('\n⚠️  Some checks failed. Please review the implementation.');
    process.exit(1);
}
