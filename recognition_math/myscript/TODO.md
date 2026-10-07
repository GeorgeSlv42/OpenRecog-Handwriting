# myscript/ — MyScript evaluation

**Owner:** Dev C

MyScript is the specialist for handwritten math → LaTeX (see `../README.md`). It's commercial.

## Before writing anything

- [ ] Licensing: evaluation/dev license terms, production pricing for our scale, on-device vs. cloud
- [ ] Platforms: confirm Android, iOS, web support from their current docs
- [ ] Report both to the lead **before** signing up for anything paid

## Work

- [ ] Input format: how MyScript expects strokes (x, y, t?) vs. our `strokes[].points` — write the
      mapping here
- [ ] Run every file in `../dataset/` through it, save raw output + LaTeX to a results file for
      `../evaluation/`
- [ ] Record: accuracy (from evaluation), latency, offline support, model/SDK size
- [ ] Note what else it returns (symbol bounding boxes? alternatives? confidence?) — feeds `../schema/`

## Done when

- [ ] `results.md` here with numbers and a recommendation (use / don't use / need more data)
