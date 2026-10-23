import { supabase } from './supabaseClient';

// 1. ดึงข้อมูลหมวดหมู่และไอเทมทั้งหมดจาก Supabase
export async function fetchCategoriesFromDB() {
  const { data, error } = await supabase
    .from('category_items')
    .select(`
      id,
      item_value,
      image_url,
      categories (key_name)
    `);

  if (error) {
    console.error('Error fetching categories:', error);
    return null;
  }

  // จัดรูปแบบข้อมูลให้ตรงกับที่เกมต้องการ (แยกตาม key_name เช่น position, league, nationality)
  const formatted = { position: [], league: [], nationality: [] };
  
  data.forEach(item => {
    const key = item.categories.key_name;
    if (formatted[key]) {
      formatted[key].push({ id: item.id, value: item.item_value, image: item.image_url || '' });
    }
  });

  return formatted;
}

// 2. เพิ่มข้อมูลไอเทมใหม่ลงฐานข้อมูล SQL
export async function addItemToDB(categoryKey, value, imageUrl = '') {
  // หา category_id จาก key_name
  const { data: catData, error: catError } = await supabase
    .from('categories')
    .select('id')
    .eq('key_name', categoryKey)
    .single();

  if (catError) {
    console.error('Category not found:', catError);
    return null;
  }

  // บันทึกลงตาราง category_items
  const { data, error } = await supabase
    .from('category_items')
    .insert([{ category_id: catData.id, item_value: value, image_url: imageUrl }])
    .select();

  if (error) {
    console.error('Error adding item:', error);
    return null;
  }

  return data[0];
}

// 3. อัปโหลดรูปภาพไปที่ Supabase Storage และอัปเดต URL ลง Database
export async function uploadCardImage(file, categoryKey, itemId) {
  const fileExt = file.name.split('.').pop();
  const fileName = `${categoryKey}-${itemId}-${Date.now()}.${fileExt}`;
  const filePath = `${fileName}`;

  // อัปโหลดไฟล์ไปที่ Storage Bucket ชื่อ 'card-images'
  const { error: uploadError } = await supabase.storage
    .from('card-images')
    .upload(filePath, file);

  if (uploadError) {
    console.error('Error uploading image:', uploadError);
    return null;
  }

  // ดึง Public URL ของรูปภาพ
  const { data: publicURLData } = supabase.storage
    .from('card-images')
    .getPublicUrl(filePath);

  const publicUrl = publicURLData.publicUrl;

  // อัปเดต image_url ในตาราง category_items
  const { error: updateError } = await supabase
    .from('category_items')
    .update({ image_url: publicUrl })
    .eq('id', itemId);

  if (updateError) {
    console.error('Error updating image url in db:', updateError);
    return null;
  }

  return publicUrl;
}