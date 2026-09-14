"""Generate an uncompressed Explicit VR Little Endian DICOM test pattern (stdlib only)."""
from pathlib import Path
import math
import struct


def element(group, tag, vr, value):
    if isinstance(value, str):
        value = value.encode('ascii')
    if len(value) % 2:
        value += b'\0' if vr in ('UI', 'OB', 'OW') else b' '
    header = struct.pack('<HH', group, tag) + vr.encode('ascii')
    if vr in ('OB', 'OW'):
        header += b'\0\0' + struct.pack('<I', len(value))
    else:
        header += struct.pack('<H', len(value))
    return header + value


def us(group, tag, value):
    return element(group, tag, 'US', struct.pack('<H', value))


def generate(slice_index=0, series=False):
    sop_class = '1.2.840.10008.5.1.4.1.1.7'
    uid = '2.25.28540923620985920184628319476198312501'
    instance_uid = uid + f'.{slice_index + 10}' if series else uid
    meta = element(2, 1, 'OB', b'\0\1')
    meta += element(2, 2, 'UI', sop_class) + element(2, 3, 'UI', instance_uid)
    meta += element(2, 0x10, 'UI', '1.2.840.10008.1.2.1')
    meta += element(2, 0x12, 'UI', uid + '.1')
    data = element(8, 0x16, 'UI', sop_class) + element(8, 0x18, 'UI', instance_uid)
    data += element(8, 0x60, 'CS', 'OT') + element(8, 0x64, 'CS', 'SYN')
    data += element(8, 0x103e, 'LO', 'Synthetic grayscale test pattern')
    data += element(0x10, 0x10, 'PN', 'SAMPLE^SYNTHETIC')
    data += element(0x10, 0x20, 'LO', 'NO-PATIENT-DATA')
    data += element(0x20, 0x0d, 'UI', uid + '.2') + element(0x20, 0x0e, 'UI', uid + '.3')
    data += element(0x20, 0x13, 'IS', str(slice_index + 1))
    data += element(0x20, 0x32, 'DS', f'0\\0\\{slice_index}')
    data += element(0x20, 0x37, 'DS', '1\\0\\0\\0\\1\\0')
    data += element(0x28, 0x30, 'DS', '1\\1')
    data += us(0x28, 2, 1) + element(0x28, 4, 'CS', 'MONOCHROME2')
    data += us(0x28, 0x10, 256) + us(0x28, 0x11, 256)
    for tag, value in [(0x100, 8), (0x101, 8), (0x102, 7), (0x103, 0)]:
        data += us(0x28, tag, value)
    data += element(0x28, 0x1050, 'DS', '128') + element(0x28, 0x1051, 'DS', '256')
    pixels = bytes(int(40 + 200 * x / 255) if math.hypot(x - 128, y - 128) < (60 + slice_index * 4 if series else 105) else 12
                   for y in range(256) for x in range(256))
    data += element(0x7fe0, 0x10, 'OB', pixels)
    output = Path(__file__).resolve().parents[1] / 'examples/basic/public/sample.dcm'
    if series:
        output = output.parent / 'series' / f'slice-{slice_index + 1:02d}.dcm'
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(bytes(128) + b'DICM' + element(2, 0, 'UL', struct.pack('<I', len(meta))) + meta + data)
    print(output)

generate()
for slice_index in range(12):
    generate(slice_index, series=True)
