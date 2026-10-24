# UC San Diego Recreation Aquatics — unofficial preview

A mock-up of [UC San Diego Recreation's pool pages](https://recreation.ucsd.edu/facilities/) (Aquatics, Canyonview Aquatic
Center, Natatorium, Aquatic Classes, Masters Swimming, Clubs & Varsity) with Canyonview's two pools and the Main Gym
Natatorium on one live [Pool Relay](https://www.poolrelay.com) schedule. Not operated by or affiliated with UC San Diego.

No schedule is typed into the pages. Hours, class days and times, Masters workouts, club practices and Triton home events
are filled by `finder.js` from the live Pool Relay views; `build.py` holds only prices, ages, policies and facts about the water.

- `build.py`: generates the six pages.
- `finder.js`: `#finder` (swim-now board), `#today`, `#week`, and `data-live` elements (`hours`, `when`, `exceptions`,
  `dates`, `swims`). `data-group` picks a program by its Pool Relay group; `data-pool="a|b"` reads one program at several pools.
- Pool Relay views: `cKyAVO7EZFuRYQSwQe1in4` (Canyonview Aquatic Center, lane by lane), `xT8SP4qsZAvolwR9xYrNIq`
  (Main Gym Natatorium, lane by lane).
