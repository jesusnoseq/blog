---
title: "Vibecoding"
date: 2026-08-08T23:55:34+01:00
draft: true
tags: ["AI", "games", "investment", "dev"]
categories: ["blog"]
---

Hace un par de semanas empece con el proyecto de <https://fuboh.com> haciendo vibecoding. El grueso del proyecto lo hice en una y la segunda semana ha sido de mejora. Aun le podria dedicar otra semana mas a dejarlo de verdad pulido.

Actualmente el juego permite jugar con teclado (no recomendable), gamepad y VR desde el navegador. Tambien incluye unos cuantos modos; versus IA, versus jugadores online o local y todas sus variantes.

Hace tiempo que tenia un juego asi en mente y hacerlo a la vieja usanza me hubiera llevado probablemente un año o dos.

Pese a ser en su totalidad vibecodeado, lleva tiempo hacerlo, un LLM no sabe como se tiene que sentir al jugar al juego, no te puede hacer de tester ni de diseñador.

## Detalles sobre Fuboh.com

Cuando vi el dominio libre no me lo pensé mucho... Lo hago.
Investigué que tecnologias usar para hacerlo web y muy accesible.
Di con Babylon.js como game engine, rapier3d para las fisicas y  colyseus para el multijugador. Hace unos años hubiera sido bastante mas complicado hacerlo sin estas librerias extraordinarias y abiertas. Gracias por existir.

### Codigo

El juego esta vibecodeado usando claude code con el modelo Claude Opus 5 mayormente.
Para el sonido, escenarios y algunas mejoras del menu he usado kimi k3 y GPT 5.6 (sol y luna)

#### Herramientas de IA

He usado claude code y opencode. El MCPs de [context7](https://context7.com/) y las skills que me recomendó [autoskills](https://www.autoskills.sh/)
Solo he tenido un CLAUDE.md, opencode hace fallback a el, asi que no hace falta tener ambos.

### Estilo visual

Teniendo ser 3D, para navegador, y que permita jugarse VR pues no hay muchas mas opciones que usar low poly para asegurar el tiro.
Es mas, el juego no calcula sombras, las que ves son "artificiales", como si fuera un png estirado puesto directamente debajo de la pelota o los muñecos.

### Sonido

Para el sonido he recortado un trozo de audio de una partida de futbolin, se la he pasado a GPT 5.6 sol y le he dicho que lo reproduzca programaticamente teniendo en cuenta velocidad etc. Ha hecho magia.
La parte musical está aun pendiente. Con el MCP de Resonant se hace magia pero no quiero meter un audio de 1.5mb por cada escenario a una aplicacion web, cosas de ser un desarrollador viejales.

### Proceso

Refinar una spec inicial con Claude Desktop donde ya le especifico lo que quiero y como lo quiero; lenguajes, librerias, estilo, target final, que está dentro del scope, que fuera y haciendo que me pregunte sobre el proyecto hasta tener algo mas concreto. Despues le pido que me ayude a escribir los prompts, los reviso y voy paso a paso pidiendo que implemente los prompts y revisando.

## Lecciones aprendidas

Con este ya son unos cuantos proyectos que hago usando LLMs y diferentes herramientas para controlarlos.

* Siempre he recomendado ir poquito a poco y teniendo el control sobre el codigo generado. Esto lo sigo recomendando pero con una excepcion; si simplemente quieres hacer un prototipo para ver si funciona y no te importa no tener el control pues ya puedes ver que el resultado no es tan malo. Ten en mente que para hacer cualquier cambio, aunque sea minimo, dependes de la IA o de tener tiempo para andar rebuscando en ficheros.
* Recuperar el ownership del proyecto una vez perdido puede ser costoso.
* Un LLM es capaz de generar sonidos procedurales a partir de un fichero wav. Mayor compresion que esa es complicada de conseguir.
* Tambien es capaz de diseñar en 3D escenarios, figuras y lo que haga falta. No esperes mucha definicion o que sea perfecto a la primera. Es normal que ponga las caras del reves y veas el modelo negro.
* El modo plan gasta muchos tokens, no siempre merece la pena. Con el juego del futbolin alcanzaba contextos de 150k o 300k tokens rapido.
* Los tests son aun mas importantes. También que sean rapidos. En el fichero de AGENTS.md o equivalente merece la pena indicar el flujo de validacion que debe de tener cada cambio.
