import unittest
from extract_silhouette import decode, extract, interpret, summarize_jobs, device_responses, binary_deltas


def row(frame, value, attribute='0x0020', connection='0x001'):
    return dict(frame=frame, value=value.hex(), attribute=attribute,
                connection=connection, opcode=0x12, time_epoch='0')


class ExtractionTests(unittest.TestCase):
    def test_split_command_with_interleaved_query(self):
        commands, queries, trailing = decode([
            row(1, b'TF3,'), row(2, b'\x1b\x05'), row(3, b'1\x03FX2,1\x03M10')])
        self.assertEqual([c['text'] for c in commands], ['TF3,1', 'FX2,1'])
        self.assertEqual(commands[0]['first_frame'], 1)
        self.assertEqual(commands[0]['last_frame'], 3)
        self.assertEqual(len(queries), 1)
        self.assertEqual(trailing, b'M10'.hex())

    def test_unrelated_streams_not_merged(self):
        rows = [row(1, b'TF3,1\x03', connection='0x001'),
                row(2, b'FX2,1\x03', connection='0x002')]
        self.assertEqual(extract(rows), [])
        self.assertEqual(extract([row(1, b'hello\x03world\x03')]), [])

    def test_geometry_crosses_packets_and_ignores_return_home(self):
        cmds, _, _ = decode([row(1, b'M0,0\x03D200,0\x03D200,200\x03'),
                              row(2, b'D0,200\x03D0,0\x03M0,0\x03')])
        _, paths, _ = interpret(cmds)
        self.assertEqual(len(paths), 1)
        self.assertEqual(paths[0]['shape'], 'square')
        self.assertEqual(paths[0]['size_mm_assuming_20_units_per_mm'], [10,10])

    def test_two_jobs_repeated_passes_and_identity(self):
        path = b'M0,0\x03D20,0\x03D0,20\x03D0,0\x03'
        cmds, _, _ = decode([row(1, b'TG2\x03FX20,1\x03!11,1\x03TF2,1\x03'+path+b'H\x03'),
                              row(2, b'TG2\x03FX21,1\x03!12,1\x03TF3,1\x03'+path+path+b'H\x03')])
        jobs = summarize_jobs(cmds)
        self.assertEqual([j['observed_passes'] for j in jobs], [1,2])
        self.assertEqual(jobs[1]['settings_by_tool']['1'],
                         {'force':21, 'speed':12, 'blade_depth':3})
        reply = row(3, b'CAMEO 5 ALPHA V1.04    \x03')
        reply['opcode'] = 0x1d
        self.assertEqual(device_responses([reply])[0]['text'], 'CAMEO 5 ALPHA V1.04')
        reply['opcode'] = 0x12
        self.assertEqual(device_responses([reply]), [])

    def test_partial_job_and_nonrepeating_geometry(self):
        cmds, _, _ = decode([row(1, b'M0,0\x03D20,0\x03M1,1\x03D21,1\x03')])
        job = summarize_jobs(cmds)[0]
        self.assertFalse(job['start_marker_seen'])
        self.assertFalse(job['end_marker_seen'])
        self.assertEqual(job['observed_passes'], 1)
        self.assertEqual(len(job['unique_pass_paths']), 2)

    def test_binary_movement_and_bad_payload(self):
        self.assertEqual(list(binary_deltas(bytes.fromhex('4245319190'))), [(0,1)])
        self.assertEqual(list(binary_deltas(bytes.fromhex('4245323cff8f'))), [(0,-112)])
        with self.assertRaises(ValueError):
            list(binary_deltas(b'BE2xx'))
        cmds, _, _ = decode([row(1, b'M10,20\x03BE1\x91'), row(2,b'\x90\x03')])
        _, paths, errors = interpret(cmds)
        self.assertEqual(paths[0]['points_xy_units'], [[20,10],[21,10]])
        self.assertEqual(errors, [])


if __name__ == '__main__':
    unittest.main()
