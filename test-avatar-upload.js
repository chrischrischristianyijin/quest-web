import { supabaseService } from './supabase/config.js';

async function testAvatarUpload() {
    console.log('🧪 测试头像上传功能');
    console.log('========================');
    
    try {
        // 1. 检查 Storage bucket 是否存在
        console.log('\n1. 检查 Storage bucket...');
        const { data: buckets, error: bucketsError } = await supabaseService.storage.listBuckets();
        
        if (bucketsError) {
            console.error('❌ 获取 Storage buckets 失败:', bucketsError);
            return;
        }
        
        console.log('✅ 当前 Storage buckets:', buckets.map(b => b.name));
        
        const avatarsBucket = buckets.find(b => b.name === 'avatars');
        if (!avatarsBucket) {
            console.log('⚠️  avatars bucket 不存在，需要创建');
            console.log('请在 Supabase Dashboard 中创建 avatars bucket');
        } else {
            console.log('✅ avatars bucket 存在');
        }
        
        // 2. 检查 bucket 权限
        console.log('\n2. 检查 bucket 权限...');
        if (avatarsBucket) {
            const { data: files, error: filesError } = await supabaseService.storage
                .from('avatars')
                .list();
            
            if (filesError) {
                console.error('❌ 访问 avatars bucket 失败:', filesError);
                console.log('可能需要配置 bucket 权限');
            } else {
                console.log('✅ avatars bucket 可访问');
                console.log('当前文件数量:', files.length);
            }
        }
        
        // 3. 测试上传小文件
        console.log('\n3. 测试上传功能...');
        const testFileName = `test_${Date.now()}.png`;
        
        // 创建一个简单的 PNG 图片数据（1x1 像素的透明图片）
        const pngData = Buffer.from([
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
            0x00, 0x00, 0x00, 0x0D, // IHDR chunk length
            0x49, 0x48, 0x44, 0x52, // IHDR
            0x00, 0x00, 0x00, 0x01, // width: 1
            0x00, 0x00, 0x00, 0x01, // height: 1
            0x08, 0x02, 0x00, 0x00, 0x00, // bit depth, color type, compression, filter, interlace
            0x90, 0x77, 0x53, 0xDE, // CRC
            0x00, 0x00, 0x00, 0x0C, // IDAT chunk length
            0x49, 0x44, 0x41, 0x54, // IDAT
            0x08, 0x99, 0x01, 0x01, 0x00, 0x00, 0x00, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01, // compressed data
            0x00, 0x00, 0x00, 0x00, // IEND chunk length
            0x49, 0x45, 0x4E, 0x44, // IEND
            0xAE, 0x42, 0x60, 0x82  // CRC
        ]);
        
        const { data: uploadData, error: uploadError } = await supabaseService.storage
            .from('avatars')
            .upload(testFileName, pngData, {
                contentType: 'image/png',
                cacheControl: '3600',
                upsert: true
            });
        
        if (uploadError) {
            console.error('❌ 测试上传失败:', uploadError);
            console.log('可能的原因:');
            console.log('- Storage bucket 权限配置不正确');
            console.log('- RLS 策略阻止上传');
            console.log('- 服务角色密钥权限不足');
        } else {
            console.log('✅ 测试上传成功:', uploadData);
            
            // 获取公共 URL
            const { data: urlData } = supabaseService.storage
                .from('avatars')
                .getPublicUrl(testFileName);
            
            console.log('✅ 公共 URL:', urlData.publicUrl);
            
            // 清理测试文件
            const { error: deleteError } = await supabaseService.storage
                .from('avatars')
                .remove([testFileName]);
            
            if (deleteError) {
                console.log('⚠️  清理测试文件失败:', deleteError);
            } else {
                console.log('✅ 测试文件已清理');
            }
        }
        
    } catch (error) {
        console.error('❌ 测试过程中发生错误:', error);
    }
}

// 运行测试
testAvatarUpload(); 