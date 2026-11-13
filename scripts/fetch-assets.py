"""Fetch only the documented redistributable assets; no account or generation API."""
import hashlib, io, json, pathlib, urllib.request, zipfile

root = pathlib.Path(__file__).resolve().parents[1] / 'public' / 'assets'
root.mkdir(parents=True, exist_ok=True)
def get(url, referer=None):
    headers = {'User-Agent': 'Mozilla/5.0 Beaververse asset provenance check'}
    if referer: headers['Referer'] = referer
    with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=60) as response:
        return response.read()

url = json.loads(get('https://kenney.nl/download-link/6173736574732f6e61747572652d6b6974', 'https://kenney.nl/assets/nature-kit'))['url']
archive = zipfile.ZipFile(io.BytesIO(get(url, 'https://kenney.nl/assets/nature-kit')))
names = ['rock_largeA.glb', 'campfire_stones.glb', 'campfire_logs.glb']
for name in names:
    path = next(p for p in archive.namelist() if p.endswith('Models/GLTF format/' + name))
    (root / name).write_bytes(archive.read(path))
license_path = next(p for p in archive.namelist() if p.endswith('License.txt'))
(root / 'KENNEY-LICENSE.txt').write_bytes(archive.read(license_path))

base = 'https://raw.githubusercontent.com/KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0/84fa4e91af6a88989be7c99e0891cede11f2ca38/'
folder = 'addons/kaykit_medieval_hexagon_pack/Assets/gltf/buildings/green/'
for name in ['building_home_A_green.gltf', 'building_home_A_green.bin', 'building_home_B_green.gltf', 'building_home_B_green.bin', 'building_lumbermill_green.gltf', 'building_lumbermill_green.bin', 'hexagons_medieval.png']:
    (root / name).write_bytes(get(base + folder + name))
(root / 'KAYKIT-LICENSE.txt').write_bytes(get(base + 'LICENSE.txt'))
(root / 'beaver.glb').write_bytes(get('https://static.poly.pizza/fb953f9b-18e0-4c1e-9df0-dc69d1499aab.glb'))
beaver = get('https://gobkit.com/freebies/animal008/Beaver.glb')
if hashlib.sha256(beaver).hexdigest() != '72fed180b8a909ee24bc17751ac427a7de76e232a997f1cc8bd5ba1870d9b986':
    raise ValueError('Gobkit Beaver changed upstream; inspect and review before replacing the pinned asset')
(root / 'beaver-gobkit.glb').write_bytes(beaver)
for p in root.iterdir(): print(p.name, p.stat().st_size)
print('Forest files are already vendored. Their author download is the free tier at https://kaylousberg.itch.io/kaykit-forest; see ASSET-LICENSES.md.')
