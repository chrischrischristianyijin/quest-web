import { supabaseService } from './supabase/config.js';
import fs from 'fs';
import path from 'path';

async function testSupabaseStorage() {
    console.log('🧪 测试 Supabase Storage 配置');
    console.log('==============================');
    
    try {
        // 1. 检查 Storage bucket 配置
        console.log('\n1. 检查 Storage bucket...');
        const { data: buckets, error: bucketsError } = await supabaseService.storage.listBuckets();
        
        if (bucketsError) {
            console.error('❌ 获取 Storage buckets 失败:', bucketsError);
            return;
        }
        
        console.log('✅ 当前 Storage buckets:', buckets.map(b => b.name));
        
        const avatarsBucket = buckets.find(b => b.name === 'avatars');
        if (!avatarsBucket) {
            console.error('❌ avatars bucket 不存在');
            console.log('请在 Supabase Dashboard 中创建 avatars bucket');
            return;
        }
        
        console.log('✅ avatars bucket 存在');
        console.log('Bucket 配置:', {
            name: avatarsBucket.name,
            public: avatarsBucket.public,
            file_size_limit: avatarsBucket.file_size_limit,
            allowed_mime_types: avatarsBucket.allowed_mime_types
        });
        
        // 2. 测试上传本地图片文件
        console.log('\n2. 测试上传本地图片文件...');
        const imagePath = path.join(process.cwd(), 'src', 'public', '3d_avatar_12.png');
        
        if (!fs.existsSync(imagePath)) {
            console.error('❌ 图片文件不存在:', imagePath);
            return;
        }
        
        console.log('✅ 找到图片文件:', imagePath);
        
        // 读取图片文件
        const imageBuffer = fs.readFileSync(imagePath);
        const fileName = `test_avatar_${Date.now()}.png`;
        
        console.log('📁 文件信息:', {
            size: imageBuffer.length,
            fileName: fileName
        });
        
        // 上传到 Supabase Storage
        const { data: uploadData, error: uploadError } = await supabaseService.storage
            .from('avatars')
            .upload(fileName, imageBuffer, {
                contentType: 'image/png',
                cacheControl: '3600',
                upsert: true
            });
        
        if (uploadError) {
            console.error('❌ 上传失败:', uploadError);
            console.log('可能的原因:');
            console.log('- Storage bucket 权限配置不正确');
            console.log('- RLS 策略阻止上传');
            console.log('- 文件大小超过限制');
            console.log('- MIME 类型不被允许');
            return;
        }
        
        console.log('✅ 上传成功:', uploadData);
        
        // 3. 获取公共 URL
        console.log('\n3. 获取公共 URL...');
        const { data: urlData } = supabaseService.storage
            .from('avatars')
            .getPublicUrl(fileName);
        
        if (!urlData.publicUrl) {
            console.error('❌ 无法获取公共 URL');
            return;
        }
        
        console.log('✅ 公共 URL:', urlData.publicUrl);
        
        // 4. 测试 URL 可访问性
        console.log('\n4. 测试 URL 可访问性...');
        try {
            const response = await fetch(urlData.publicUrl);
            if (response.ok) {
                console.log('✅ URL 可以正常访问');
                console.log('Content-Type:', response.headers.get('content-type'));
                console.log('Content-Length:', response.headers.get('content-length'));
            } else {
                console.log('⚠️  URL 访问受限:', response.status, response.statusText);
            }
        } catch (error) {
            console.log('⚠️  URL 访问测试失败:', error.message);
        }
        
        // 5. 清理测试文件
        console.log('\n5. 清理测试文件...');
        const { error: deleteError } = await supabaseService.storage
            .from('avatars')
            .remove([fileName]);
        
        if (deleteError) {
            console.log('⚠️  清理测试文件失败:', deleteError);
        } else {
            console.log('✅ 测试文件已清理');
        }
        
        // 6. 检查 RLS 策略
        console.log('\n6. 检查 RLS 策略建议...');
        console.log('确保在 Supabase Dashboard 中配置了正确的 RLS 策略:');
        console.log('- 允许认证用户上传文件');
        console.log('- 允许公开访问头像文件');
        console.log('- 设置适当的文件大小限制');
        
    } catch (error) {
        console.error('❌ 测试过程中发生错误:', error);
    }
}

// 运行测试
testSupabaseStorage(); 