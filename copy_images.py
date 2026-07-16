import shutil
import os

source_dir = '/Users/muhammedshareefcv/.gemini/antigravity-ide/brain/d81aacfd-ca94-4147-bd40-c1e593c95da5'
dest_dir = '/Users/muhammedshareefcv/Desktop/AlipsonBuilders/public/images'

images = {
    'hero_background_1784178681407.png': 'hero_background.png',
    'project_grandeur_1784178695302.png': 'project_grandeur.png',
    'project_heights_1784178709256.png': 'project_heights.png',
    'project_hub_1784178724388.png': 'project_hub.png',
    'project_residency_1784178741956.png': 'project_residency.png',
    'interior_living_1784178762850.png': 'interior_living.png'
}

for src_name, dest_name in images.items():
    src_path = os.path.join(source_dir, src_name)
    dest_path = os.path.join(dest_dir, dest_name)
    print(f"Copying {src_path} to {dest_path}")
    shutil.copy(src_path, dest_path)

print("All images copied successfully!")
