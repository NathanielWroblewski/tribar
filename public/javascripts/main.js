import Vector from './models/vector.js'
import FourByFour from './models/four_by_four.js'
import Camera from './models/orthographic.js'
import angles from './isomorphisms/angles.js'
import coordinates from './isomorphisms/coordinates.js'
import renderLine from './views/line.js'
import renderCircle from './views/circle.js'
import renderPolygon from './views/polygon.js'
import { seed, noise } from './utilities/noise.js'
import { stableSort, remap } from './utilities/index.js'
import { COLORS, BLACK, BLUE } from './constants/colors.js'
import { ZOOM, FPS, Δt, CUBE_FACES, X_AXIS, Y_AXIS, Z_AXIS, FRAMES } from './constants/dimensions.js'

// Copyright (c) 2020 Nathaniel Wroblewski
// I am making my contributions/submissions to this project solely in my personal
// capacity and am not conveying any rights to any intellectual property of any
// third parties.

const canvas = document.querySelector('.canvas')
const context = canvas.getContext('2d')

const { sin, cos } = Math

const perspective = FourByFour.identity()
  .rotX(angles.toRadians(-35.27))
  .rotY(angles.toRadians(45))

const camera = new Camera({
  position: Vector.zeroes(),
  direction: Vector.zeroes(),
  up: Vector.from([0, 1, 0]),
  width: canvas.width,
  height: canvas.height,
  zoom: ZOOM
})

seed(Math.random())

const CUBE_VERTICES = [
  Vector.from([ 1,  1,  1]),
  Vector.from([-1,  1,  1]),
  Vector.from([ 1, -1,  1]),
  Vector.from([-1, -1,  1]),
  Vector.from([ 1,  1, -1]),
  Vector.from([-1,  1, -1]),
  Vector.from([ 1, -1, -1]),
  Vector.from([-1, -1, -1]),
]

const campos = Vector.from([10, 10, 10])

const renderComparator = (a, b) => {
  const a0 = campos.subtract(a.center.transform(perspective))
  const b0 = campos.subtract(b.center.transform(perspective))

  if (a0.z < b0.z) return -1
  if (a0.z > b0.z) return 1
  if (a0.x < b0.x) return -1
  if (a0.x > b0.x) return 1
  if (a0.y < b0.y) return -1
  if (a0.y > b0.y) return 1
  return 0
}

const faces = []

const coords = [
  Vector.from([-6, -6, 10]),
  Vector.from([-6, -6, 8]),
  Vector.from([-6, -6, 6]),
  Vector.from([-6, -6, 4]),
  Vector.from([-6, -6, 2]),
  Vector.from([-6, -6, 0]),
  Vector.from([-6, -4, 0]),
  Vector.from([-6, -2, 0]),
  Vector.from([-6, -0, 0]),
  Vector.from([-6,  2, 0]),
  Vector.from([-6,  4, 0]),
  Vector.from([-4,  4, 0]),
  Vector.from([-2,  4, 0]),
  Vector.from([ 0,  4, 0]),
  Vector.from([ 2,  4, 0]),
]

coords.forEach(coord => {
  const cube = CUBE_VERTICES.map(vertex => vertex.add(coord))

  CUBE_FACES.forEach((face, index) => {
    const direction = index === 5 ? -1 : 1
    const vertices = face.map(index => cube[index])
    const center = vertices[2].subtract(vertices[0]).divide(2).add(vertices[0])

    faces.push({
      type: 'polygon',
      vertices,
      center,
      stroke: BLACK
    })
  })
})

const transforms = [
  { rotate: -90, about: faces => faces[3].vertices[0], axis: Z_AXIS },
  { rotate: -90, about: faces => faces[3].vertices[0], axis: Z_AXIS },
  { rotate: 90, about: faces => faces[3].vertices[3], axis: Y_AXIS },
  { rotate: 90, about: faces => faces[0].vertices[3], axis: Y_AXIS },
  { rotate: 90, about: faces => faces[1].vertices[0], axis: Y_AXIS },
  { rotate: 90, about: faces => faces[0].vertices[1], axis: Y_AXIS },
  { rotate: 90, about: faces => faces[0].vertices[2], axis: Y_AXIS },
  { rotate: 90, about: faces => faces[0].vertices[3], axis: Y_AXIS },
  { rotate: 90, about: faces => faces[0].vertices[3], axis: Y_AXIS },
  { rotate: 90, about: faces => faces[0].vertices[3], axis: X_AXIS },
  { rotate: 90, about: faces => faces[0].vertices[1], axis: X_AXIS },
  { rotate: 90, about: faces => faces[2].vertices[0], axis: X_AXIS },
  { rotate: 90, about: faces => faces[1].vertices[0], axis: X_AXIS },
  { rotate: 90, about: faces => faces[0].vertices[0], axis: X_AXIS },
  { rotate: 90, about: faces => faces[3].vertices[0], axis: X_AXIS },
  { rotate: 90, about: faces => faces[3].vertices[0], axis: X_AXIS },
  { rotate: -90, about: faces => faces[0].vertices[2], axis: Z_AXIS },
  { rotate: -90, about: faces => faces[3].vertices[1], axis: Z_AXIS },
  { rotate: -90, about: faces => faces[0].vertices[0], axis: Z_AXIS },
  { rotate: -90, about: faces => faces[2].vertices[0], axis: Z_AXIS },
  { rotate: -90, about: faces => faces[3].vertices[0], axis: Z_AXIS },
]

const states = []
const cubeFaces = []
const cube = CUBE_VERTICES.map(vertex => vertex.add(coords[0].add(Vector.from([0, 2, 0]))))

CUBE_FACES.forEach(face => {
  const vertices = face.map(index => cube[index])
  const center = vertices[2].subtract(vertices[0]).divide(2).add(vertices[0])

  cubeFaces.push({
    type: 'polygon',
    vertices,
    center,
    stroke: BLACK,
    fill: BLUE
  })
})

// compute the entire path of the box
for (let time = 0; time < transforms.length * FRAMES; time++) {
  const transformIndex = Math.floor(time / FRAMES)
  const { rotate, about, axis } = transforms[transformIndex]
  const polys = (states[time - 1] || cubeFaces)

  states[time] = polys.map(face => ({
    ...face,
    vertices: face.vertices.map(vertex => {
      return vertex.rotateAround(
        about(polys), axis, angles.toRadians(rotate/FRAMES)
      )
    }),
    center: face.center.rotateAround(
      about(polys), axis, angles.toRadians(rotate/FRAMES)
    )
  }))
}

let times = [0, 10 * FRAMES]

const getColor = ([x, y, z]) => {
  if ((y === -6 && x === -5) || (x === -5)) return COLORS[12]
  if ((z === -1 && x === -6) || (z === -1)) return COLORS[21]
  if (z === 0 || x === -6) return COLORS[0]

  return null
}

const render = () => {
  context.clearRect(0, 0, canvas.width, canvas.height)

  const cubes = times.reduce((memo, time) => memo.concat(states[time]), [])

  const polygons = stableSort(faces, renderComparator)
    .concat([faces[5], faces[11]])
    .concat(stableSort(cubes, renderComparator))

  polygons.forEach(face => {
    const color = face.fill || getColor(face.center)
    const projected = face.vertices.map(vertex => {
      return camera.project(vertex.transform(perspective))
    })

    renderPolygon(context, projected, face.stroke, color, 1)
  })

  times = times.map(time => time === (transforms.length * FRAMES - 1) ? 0 : time += Δt)
}

let prevTick = 0

const step = () => {
  window.requestAnimationFrame(step)

  const now = Math.round(FPS * Date.now() / 1000)
  if (now === prevTick) return
  prevTick = now

  render()
}

step()
